/**
 * Main-thread bridge to the query worker (T08–T12).
 */
import {
  type ExportChunk,
  parseWorkerToMain,
  type QueryResult,
  type StreamStatus,
  type SuggestResult,
  type WorkerToMain,
} from "@repo/shared";
import type { DashboardStore } from "../state/dashboard-store";

export type QueryWorkerHandle = {
  startStream: (sseUrl: string, totalExpected: number) => void;
  query: (args: {
    search: string;
    filters: Record<string, string[]>;
    sort: { field: string; direction: "asc" | "desc" };
    offset: number;
    limit: number;
    analysisMode: "all" | "analysis" | "aiAnalysis";
  }) => Promise<QueryResult>;
  suggest: (prefix: string, limit?: number) => Promise<string[]>;
  exportCsv: (args: {
    search: string;
    filters: Record<string, string[]>;
    sort: { field: string; direction: "asc" | "desc" };
    analysisMode: "all" | "analysis" | "aiAnalysis";
  }) => Promise<Blob>;
  terminate: () => void;
};

export function createQueryWorker(store: DashboardStore): QueryWorkerHandle {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const pendingQueries = new Map<
    string,
    { resolve: (v: QueryResult) => void; reject: (e: Error) => void }
  >();
  const pendingSuggest = new Map<
    string,
    { resolve: (v: string[]) => void; reject: (e: Error) => void }
  >();
  const pendingExport = new Map<
    string,
    { chunks: string[]; resolve: (v: Blob) => void; reject: (e: Error) => void }
  >();

  let requestSeq = 0;
  const nextId = () => `q-${++requestSeq}`;

  worker.onmessage = (event: MessageEvent<unknown>) => {
    let message: WorkerToMain;
    try {
      message = parseWorkerToMain(event.data);
    } catch {
      return;
    }

    if (message.type === "streamStatus") {
      applyStreamStatus(store, message);
      return;
    }
    if (message.type === "queryResult") {
      const pending = pendingQueries.get(message.requestId);
      if (!pending) return;
      pendingQueries.delete(message.requestId);
      store.dispatch({
        type: "page/result",
        total: message.total,
        rows: message.rows,
      });
      pending.resolve(message);
      return;
    }
    if (message.type === "suggestResult") {
      const pending = pendingSuggest.get(message.requestId);
      if (!pending) return;
      pendingSuggest.delete(message.requestId);
      pending.resolve(message.suggestions);
      return;
    }
    if (message.type === "exportChunk") {
      const pending = pendingExport.get(message.requestId);
      if (!pending) return;
      if (message.chunk) pending.chunks.push(message.chunk);
      if (message.done) {
        pendingExport.delete(message.requestId);
        pending.resolve(new Blob(pending.chunks, { type: "text/csv;charset=utf-8" }));
      }
    }
  };

  return {
    startStream(sseUrl, totalExpected) {
      worker.postMessage({
        version: 1,
        type: "startStream",
        sseUrl,
        totalExpected,
      });
    },
    query(args) {
      const requestId = nextId();
      return new Promise<QueryResult>((resolve, reject) => {
        // Supersede prior in-flight queries from the UI side.
        for (const [id, pending] of pendingQueries) {
          pendingQueries.delete(id);
          pending.reject(new Error("superseded"));
        }
        pendingQueries.set(requestId, { resolve, reject });
        worker.postMessage({
          version: 1,
          type: "query",
          requestId,
          ...args,
        });
      });
    },
    suggest(prefix, limit = 8) {
      const requestId = nextId();
      return new Promise<string[]>((resolve, reject) => {
        for (const [id, pending] of pendingSuggest) {
          pendingSuggest.delete(id);
          pending.reject(new Error("superseded"));
        }
        pendingSuggest.set(requestId, { resolve, reject });
        worker.postMessage({
          version: 1,
          type: "suggest",
          requestId,
          prefix,
          limit,
        });
      });
    },
    exportCsv(args) {
      const requestId = nextId();
      return new Promise<Blob>((resolve, reject) => {
        for (const [id, pending] of pendingExport) {
          pendingExport.delete(id);
          pending.reject(new Error("superseded"));
        }
        pendingExport.set(requestId, { chunks: [], resolve, reject });
        worker.postMessage({
          version: 1,
          type: "exportCsv",
          requestId,
          ...args,
        });
      });
    },
    terminate() {
      worker.terminate();
      pendingQueries.clear();
      pendingSuggest.clear();
      pendingExport.clear();
    },
  };
}

function applyStreamStatus(store: DashboardStore, status: StreamStatus): void {
  store.dispatch({
    type: "stream/status",
    connection: status.connection,
    recordsReceived: status.recordsReceived,
    totalExpected: status.totalExpected,
    lastSequence: status.lastSequence,
    errorMessage: status.errorMessage,
  });
}

export type { ExportChunk, SuggestResult };
