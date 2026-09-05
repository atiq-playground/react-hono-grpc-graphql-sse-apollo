import { randomUUID } from "node:crypto";
import {
  AnalysisModeSchema,
  FindingFiltersSchema,
  FindingSortSchema,
  type ResolvedTimeRange,
} from "@repo/shared";
import type Redis from "ioredis";
import { z } from "zod/mini";
import { EXPORT_TTL_SECONDS } from "../../env.js";
import type { ExportQueryInput } from "../findings-query.types.js";
import { EXPORT_STATUSES, type ExportJob } from "./export.types.js";

const EXPORT_JOB_PREFIX = "export-job:";
const EXPORT_JOB_MAX_BYTES = 256 * 1024;
const GRAPHQL_INT_MAX = 2_147_483_647;

// [schemas]

const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const ExportJobIdSchema = z
  .string()
  .check(
    z.maxLength(36),
    z.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  );

const StoredExportRequestSchema = z.object({
  filters: FindingFiltersSchema,
  timeRange: z.object({
    from: z.nullable(IsoDateTimeSchema),
    to: z.nullable(IsoDateTimeSchema),
  }),
  analysisMode: AnalysisModeSchema,
  search: z.nullable(z.string().check(z.maxLength(256))),
  sort: FindingSortSchema,
});

const StoredExportJobSchema = z.object({
  id: ExportJobIdSchema,
  status: z.enum(EXPORT_STATUSES),
  rowCount: z.nullable(z.number().check(z.int(), z.gte(0), z.lte(GRAPHQL_INT_MAX))),
  artifactName: z.nullable(z.string().check(z.maxLength(40), z.regex(/^[0-9a-f-]{36}\.csv$/))),
  errorMessage: z.nullable(z.string().check(z.maxLength(256))),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  request: StoredExportRequestSchema,
});

// [types]

export type StoredExportRequest = z.infer<typeof StoredExportRequestSchema>;
export type StoredExportJob = z.infer<typeof StoredExportJobSchema>;

const UPDATE_WITH_TTL_SCRIPT = `
local ttl = redis.call("PTTL", KEYS[1])
if ttl <= 0 then
  return 0
end
redis.call("SET", KEYS[1], ARGV[1], "PX", ttl)
return 1
`;

const READY_WITH_EVENT_SCRIPT = `
local ttl = redis.call("PTTL", KEYS[1])
if ttl <= 0 then
  return false
end
redis.call("SET", KEYS[1], ARGV[1], "PX", ttl)
return redis.call("XADD", KEYS[2], "MAXLEN", "~", ARGV[2], "*", "event", ARGV[3])
`;

function jobKey(id: string): string {
  return `${EXPORT_JOB_PREFIX}${id}`;
}

function serializeJob(job: StoredExportJob): string {
  const payload = JSON.stringify(StoredExportJobSchema.parse(job));
  if (Buffer.byteLength(payload, "utf8") > EXPORT_JOB_MAX_BYTES) {
    throw new Error("Export job metadata exceeds the storage limit");
  }
  return payload;
}

function parseStoredJob(payload: string): StoredExportJob {
  if (Buffer.byteLength(payload, "utf8") > EXPORT_JOB_MAX_BYTES) {
    throw new Error("Export job metadata exceeds the storage limit");
  }
  const job = StoredExportJobSchema.parse(JSON.parse(payload) as unknown);
  if (job.artifactName !== null && job.artifactName !== `${job.id}.csv`) {
    throw new Error("Export job contains invalid artifact metadata");
  }
  return job;
}

function storeRequest(input: ExportQueryInput): StoredExportRequest {
  return {
    filters: input.filters,
    timeRange: {
      from: input.timeRange.from?.toISOString() ?? null,
      to: input.timeRange.to?.toISOString() ?? null,
    },
    analysisMode: input.analysisMode,
    search: input.search,
    sort: input.sort,
  };
}

export function parseExportJobId(value: unknown): string {
  return ExportJobIdSchema.parse(value);
}

export function restoreExportRequest(request: StoredExportRequest): ExportQueryInput {
  const timeRange: ResolvedTimeRange = {
    from: request.timeRange.from === null ? null : new Date(request.timeRange.from),
    to: request.timeRange.to === null ? null : new Date(request.timeRange.to),
  };
  return {
    filters: request.filters,
    timeRange,
    analysisMode: request.analysisMode,
    search: request.search,
    sort: request.sort,
  };
}

export function exportDownloadUrl(id: string): string {
  return `/api/exports/${parseExportJobId(id)}`;
}

export function toExportJob(job: StoredExportJob): ExportJob {
  return {
    id: job.id,
    status: job.status,
    rowCount: job.rowCount,
    downloadUrl:
      job.status === "READY" && job.artifactName === `${job.id}.csv`
        ? exportDownloadUrl(job.id)
        : null,
    errorMessage: job.errorMessage,
    expiresAt: job.expiresAt,
  };
}

export async function createExportJob(
  redis: Redis,
  input: ExportQueryInput,
): Promise<StoredExportJob> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPORT_TTL_SECONDS * 1_000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = randomUUID();
    const job: StoredExportJob = {
      id,
      status: "PENDING",
      rowCount: null,
      artifactName: null,
      errorMessage: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      request: storeRequest(input),
    };
    const stored = await redis.set(jobKey(id), serializeJob(job), "EX", EXPORT_TTL_SECONDS, "NX");
    if (stored === "OK") return job;
  }

  throw new Error("Could not allocate an export job id");
}

export async function findExportJob(redis: Redis, id: string): Promise<StoredExportJob | null> {
  const parsedId = parseExportJobId(id);
  const payload = await redis.get(jobKey(parsedId));
  if (payload === null) return null;

  const job = parseStoredJob(payload);
  if (Date.parse(job.expiresAt) <= Date.now()) {
    await redis.del(jobKey(parsedId));
    return null;
  }
  return job;
}

export async function updateExportJob(
  redis: Redis,
  id: string,
  update: (current: StoredExportJob) => StoredExportJob,
): Promise<StoredExportJob | null> {
  const current = await findExportJob(redis, id);
  if (current === null) return null;
  const next = StoredExportJobSchema.parse(update(current));
  const result = await redis.eval(
    UPDATE_WITH_TTL_SCRIPT,
    1,
    jobKey(current.id),
    serializeJob(next),
  );
  return Number(result) === 1 ? next : null;
}

export async function markExportJobReadyAndPublish(
  redis: Redis,
  id: string,
  artifactName: string,
  eventStream: string,
  eventStreamMaxLength: number,
  encodedEvent: string,
): Promise<StoredExportJob | null> {
  const current = await findExportJob(redis, id);
  if (current === null) return null;
  const ready = StoredExportJobSchema.parse({
    ...current,
    status: "READY",
    artifactName,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
  });
  if (ready.artifactName !== `${ready.id}.csv`) {
    throw new Error("Export job contains invalid artifact metadata");
  }
  const result = await redis.eval(
    READY_WITH_EVENT_SCRIPT,
    2,
    jobKey(ready.id),
    eventStream,
    serializeJob(ready),
    eventStreamMaxLength.toString(),
    encodedEvent,
  );
  return typeof result === "string" ? ready : null;
}

export async function findIncompleteExportJobIds(redis: Redis): Promise<readonly string[]> {
  const ids: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${EXPORT_JOB_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    for (const key of keys) {
      const idParse = ExportJobIdSchema.safeParse(key.slice(EXPORT_JOB_PREFIX.length));
      if (!idParse.success) continue;
      const job = await findExportJob(redis, idParse.data);
      if (job?.status === "PENDING" || job?.status === "RUNNING") ids.push(job.id);
    }
  } while (cursor !== "0");
  return ids;
}
