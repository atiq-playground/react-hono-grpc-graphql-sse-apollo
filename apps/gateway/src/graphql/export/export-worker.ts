import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { encodeDatasetEvent, parseDatasetEvent } from "@repo/shared";
import { DATASET_EVENTS_MAXLEN, DATASET_EVENTS_STREAM, DATASET_VERSION } from "../../env.js";
import type { GatewayContext } from "../context.js";
import {
  ensureExportDirectory,
  exportArtifactName,
  resolveExportArtifactPath,
  resolveExportTemporaryPath,
} from "./artifact.js";
import {
  buildExportStatement,
  CLICKHOUSE_EXPORT_SETTINGS,
  countExportRows,
} from "./export-query.js";
import {
  exportDownloadUrl,
  findExportJob,
  findIncompleteExportJobIds,
  markExportJobReadyAndPublish,
  restoreExportRequest,
  updateExportJob,
} from "./job-store.js";

const FAILED_MESSAGE = "Export could not be completed";
const queue: string[] = [];
const queuedIds = new Set<string>();
let draining = false;

function logExportFailure(jobId: string, error: unknown): void {
  console.error(
    JSON.stringify({
      message: "gateway export job failed",
      jobId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
}

function exportReadyEvent(jobId: string): string {
  const event = parseDatasetEvent({
    v: 1,
    type: "export-ready",
    datasetVersion: DATASET_VERSION,
    at: new Date().toISOString(),
    jobId,
    url: exportDownloadUrl(jobId),
  });
  return encodeDatasetEvent(event);
}

async function markFailed(context: GatewayContext, jobId: string): Promise<void> {
  await updateExportJob(context.redis, jobId, (current) => ({
    ...current,
    status: "FAILED",
    artifactName: null,
    errorMessage: FAILED_MESSAGE,
    updatedAt: new Date().toISOString(),
  }));
}

async function runExportJob(context: GatewayContext, jobId: string): Promise<void> {
  const stored = await findExportJob(context.redis, jobId);
  if (stored === null || stored.status === "READY" || stored.status === "FAILED") return;

  const running = await updateExportJob(context.redis, jobId, (current) => ({
    ...current,
    status: "RUNNING",
    artifactName: null,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
  }));
  if (running === null) return;

  const input = restoreExportRequest(running.request);
  const temporaryPath = resolveExportTemporaryPath(jobId);
  const artifactName = exportArtifactName(jobId);
  const artifactPath = resolveExportArtifactPath(jobId, artifactName);

  try {
    await ensureExportDirectory();
    await rm(temporaryPath, { force: true });

    const rowCount = await countExportRows(context.ch, input);
    const counted = await updateExportJob(context.redis, jobId, (current) => ({
      ...current,
      rowCount,
      updatedAt: new Date().toISOString(),
    }));
    if (counted === null) return;

    const statement = buildExportStatement(input);
    const result = await context.ch.exec({
      query: statement.query,
      query_params: statement.queryParams,
      clickhouse_settings: CLICKHOUSE_EXPORT_SETTINGS,
    });
    await pipeline(result.stream, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }));
    await rename(temporaryPath, artifactPath);

    const ready = await markExportJobReadyAndPublish(
      context.redis,
      jobId,
      artifactName,
      DATASET_EVENTS_STREAM,
      DATASET_EVENTS_MAXLEN,
      exportReadyEvent(jobId),
    );
    if (ready === null) {
      await rm(artifactPath, { force: true });
      return;
    }
  } catch (error: unknown) {
    await Promise.allSettled([
      rm(temporaryPath, { force: true }),
      rm(artifactPath, { force: true }),
      markFailed(context, jobId),
    ]);
    logExportFailure(jobId, error);
  }
}

async function drainQueue(context: GatewayContext): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (jobId === undefined) continue;
      try {
        await runExportJob(context, jobId);
      } catch (error: unknown) {
        await Promise.allSettled([markFailed(context, jobId)]);
        logExportFailure(jobId, error);
      } finally {
        queuedIds.delete(jobId);
      }
    }
  } finally {
    draining = false;
  }
}

export function scheduleExportJob(context: GatewayContext, jobId: string): void {
  if (queuedIds.has(jobId)) return;
  queuedIds.add(jobId);
  queue.push(jobId);
  setImmediate(() => void drainQueue(context));
}

export async function resumeExportJobs(context: GatewayContext): Promise<void> {
  const jobIds = await findIncompleteExportJobIds(context.redis);
  for (const jobId of jobIds) scheduleExportJob(context, jobId);
}
