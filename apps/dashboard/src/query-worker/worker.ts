/// <reference lib="webworker" />
/**
 * Browser Web Worker: SSE ingest + columnar index + queries (T08/T09).
 */
import { fromBinary } from "@bufbuild/protobuf";
import { type FindingBlock, FindingBlockSchema } from "@repo/proto";
import {
  type ExportRequest,
  parseMainToWorker,
  type QueryRequest,
  type SuggestRequest,
  type WorkerToMain,
} from "@repo/shared";
import { ColumnarIndex, exportCsvChunks, queryIndex, suggest } from "./index";

declare const self: DedicatedWorkerGlobalScope;

const index = new ColumnarIndex();
let totalExpected = 0;
let lastSequence = 0;
let eventSource: EventSource | null = null;
/** Supersede token for query / suggest / export. */
let activeQueryId: string | null = null;
let activeSuggestId: string | null = null;
let activeExportId: string | null = null;
let lastProgressAt = 0;

function post(message: WorkerToMain): void {
  self.postMessage(message);
}

function postStatus(
  connection: "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error",
  errorMessage?: string,
): void {
  post({
    version: 1,
    type: "streamStatus",
    connection,
    recordsReceived: index.length,
    totalExpected,
    lastSequence,
    indexBytesEstimate: index.estimateBytes(),
    errorMessage,
  });
}

function decodeDict(
  column: { dictionary: string[]; indices: number[] } | undefined,
  rowCount: number,
): string[] {
  if (!column) return Array.from({ length: rowCount }, () => "");
  return column.indices.map((idx) => column.dictionary[idx] ?? "");
}

function sparseKai(
  sparse: { rowIndices: number[]; values: string[] } | undefined,
  rowCount: number,
): Array<string | null> {
  const out: Array<string | null> = Array.from({ length: rowCount }, () => null);
  if (!sparse) return out;
  for (let i = 0; i < sparse.rowIndices.length; i++) {
    const row = sparse.rowIndices[i];
    if (row === undefined) continue;
    out[row] = sparse.values[i] ?? null;
  }
  return out;
}

function handleBlock(data: string, eventId: string | null): void {
  let bytes: Uint8Array;
  try {
    const bin = atob(data);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    postStatus("error", "Malformed base64 frame");
    return;
  }

  let block: FindingBlock;
  try {
    block = fromBinary(FindingBlockSchema, bytes);
  } catch {
    postStatus("error", "Malformed FindingBlock protobuf");
    return;
  }

  const seq = Number(block.sequence);
  if (seq <= lastSequence) return;
  lastSequence = seq;

  // Optional SSE envelope trace (T14): ignore unknown fields; preserve across boundary via status.
  void eventId;

  const n = block.rowCount;
  index.appendBlock({
    group: [...block.group],
    repo: [...block.repo],
    image: [...block.image],
    cve: [...block.cve],
    severity: decodeDict(block.severity, n),
    packageName: [...block.packageName],
    packageVersion: [...block.packageVersion],
    packageType: decodeDict(block.packageType, n),
    status: decodeDict(block.status, n),
    advisoryType: decodeDict(block.advisoryType, n),
    kaiStatus: sparseKai(block.kaiStatus, n),
    cvss: [...block.cvss],
  });

  const now = performance.now();
  const complete = totalExpected > 0 && index.length >= totalExpected;
  if (complete || now - lastProgressAt > 250) {
    lastProgressAt = now;
    postStatus(complete ? "closed" : "open");
  }
}

function startStream(sseUrl: string, expected: number): void {
  totalExpected = expected;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  postStatus("connecting");

  eventSource = new EventSource(sseUrl);
  eventSource.addEventListener("finding-block", (event) => {
    const message = event as MessageEvent<string>;
    handleBlock(message.data, message.lastEventId);
  });
  eventSource.onopen = () => {
    postStatus("open");
  };
  eventSource.onerror = () => {
    postStatus("reconnecting");
  };
}

function runQuery(request: QueryRequest): void {
  activeQueryId = request.requestId;
  const result = queryIndex(index, request);
  if (activeQueryId !== request.requestId) return;
  post({
    version: 1,
    type: "queryResult",
    requestId: request.requestId,
    total: result.total,
    elapsedMs: result.elapsedMs,
    rows: result.rows,
  });
}

function runSuggest(request: SuggestRequest): void {
  activeSuggestId = request.requestId;
  const suggestions = suggest(index, request.prefix, request.limit);
  if (activeSuggestId !== request.requestId) return;
  post({
    version: 1,
    type: "suggestResult",
    requestId: request.requestId,
    suggestions,
  });
}

function runExport(request: ExportRequest): void {
  activeExportId = request.requestId;
  for (const chunk of exportCsvChunks(index, request)) {
    if (activeExportId !== request.requestId) return;
    post({
      version: 1,
      type: "exportChunk",
      requestId: request.requestId,
      chunk,
      done: false,
    });
  }
  if (activeExportId !== request.requestId) return;
  post({
    version: 1,
    type: "exportChunk",
    requestId: request.requestId,
    chunk: "",
    done: true,
  });
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const message = parseMainToWorker(event.data);
  switch (message.type) {
    case "startStream":
      startStream(message.sseUrl, message.totalExpected);
      break;
    case "query":
      runQuery(message);
      break;
    case "suggest":
      runSuggest(message);
      break;
    case "exportCsv":
      runExport(message);
      break;
  }
};
