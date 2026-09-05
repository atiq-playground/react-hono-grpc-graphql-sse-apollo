export const SHARED_PACKAGE = "@repo/shared" as const;
export type {
  ExportChunk,
  ExportRequest,
  MainToWorker,
  QueryRequest,
  QueryResult,
  StartStream,
  StreamStatus,
  SuggestRequest,
  SuggestResult,
  WorkerToMain,
} from "./worker-protocol.js";
export {
  ExportChunkSchema,
  ExportRequestSchema,
  MainToWorkerSchema,
  parseMainToWorker,
  parseWorkerToMain,
  QueryRequestSchema,
  QueryResultSchema,
  StartStreamSchema,
  StreamStatusSchema,
  SuggestRequestSchema,
  SuggestResultSchema,
  WorkerMessageVersion,
  WorkerToMainSchema,
} from "./worker-protocol.js";
