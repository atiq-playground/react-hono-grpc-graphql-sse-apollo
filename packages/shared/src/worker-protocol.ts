/**
 * Versioned worker <-> main-thread contracts (T08+). Validated with zod/mini.
 */
import { z } from "zod/mini";

export const WorkerMessageVersion = 1 as const;

export const StreamStatusSchema = z.object({
  version: z.literal(1),
  type: z.literal("streamStatus"),
  connection: z.enum(["idle", "connecting", "open", "reconnecting", "closed", "error"]),
  recordsReceived: z.number(),
  totalExpected: z.number(),
  lastSequence: z.number(),
  indexBytesEstimate: z.optional(z.number()),
  errorMessage: z.optional(z.string()),
});

export const QueryRequestSchema = z.object({
  version: z.literal(1),
  type: z.literal("query"),
  requestId: z.string(),
  search: z.string(),
  filters: z.record(z.string(), z.array(z.string())),
  sort: z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]),
  }),
  offset: z.number(),
  limit: z.number(),
  analysisMode: z.enum(["all", "analysis", "aiAnalysis"]),
});

export const QueryResultSchema = z.object({
  version: z.literal(1),
  type: z.literal("queryResult"),
  requestId: z.string(),
  total: z.number(),
  elapsedMs: z.number(),
  rows: z.array(
    z.object({
      index: z.number(),
      group: z.string(),
      repo: z.string(),
      image: z.string(),
      cve: z.string(),
      severity: z.string(),
      packageName: z.string(),
      packageVersion: z.string(),
      status: z.string(),
      kaiStatus: z.nullable(z.string()),
    }),
  ),
});

export const StartStreamSchema = z.object({
  version: z.literal(1),
  type: z.literal("startStream"),
  sseUrl: z.string(),
  totalExpected: z.number(),
});

export const SuggestRequestSchema = z.object({
  version: z.literal(1),
  type: z.literal("suggest"),
  requestId: z.string(),
  prefix: z.string(),
  limit: z.number(),
});

export const SuggestResultSchema = z.object({
  version: z.literal(1),
  type: z.literal("suggestResult"),
  requestId: z.string(),
  suggestions: z.array(z.string()),
});

export const ExportRequestSchema = z.object({
  version: z.literal(1),
  type: z.literal("exportCsv"),
  requestId: z.string(),
  search: z.string(),
  filters: z.record(z.string(), z.array(z.string())),
  sort: z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]),
  }),
  analysisMode: z.enum(["all", "analysis", "aiAnalysis"]),
});

export const ExportChunkSchema = z.object({
  version: z.literal(1),
  type: z.literal("exportChunk"),
  requestId: z.string(),
  chunk: z.string(),
  done: z.boolean(),
});

export const MainToWorkerSchema = z.union([
  StartStreamSchema,
  QueryRequestSchema,
  SuggestRequestSchema,
  ExportRequestSchema,
]);
export const WorkerToMainSchema = z.union([
  StreamStatusSchema,
  QueryResultSchema,
  SuggestResultSchema,
  ExportChunkSchema,
]);

export type StreamStatus = z.infer<typeof StreamStatusSchema>;
export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type QueryResult = z.infer<typeof QueryResultSchema>;
export type StartStream = z.infer<typeof StartStreamSchema>;
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;
export type SuggestResult = z.infer<typeof SuggestResultSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportChunk = z.infer<typeof ExportChunkSchema>;
export type MainToWorker = z.infer<typeof MainToWorkerSchema>;
export type WorkerToMain = z.infer<typeof WorkerToMainSchema>;

export function parseMainToWorker(value: unknown): MainToWorker {
  return MainToWorkerSchema.parse(value);
}

export function parseWorkerToMain(value: unknown): WorkerToMain {
  return WorkerToMainSchema.parse(value);
}
