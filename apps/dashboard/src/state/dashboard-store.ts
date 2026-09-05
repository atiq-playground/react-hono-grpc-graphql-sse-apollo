import { redux } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type ConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error";

export type PageRow = {
  index: number;
  group: string;
  repo: string;
  image: string;
  cve: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  status: string;
  kaiStatus: string | null;
};

export type DashboardState = {
  connection: ConnectionState;
  recordsReceived: number;
  totalExpected: number;
  lastSequence: number;
  errorMessage?: string;
  search: string;
  filters: Record<string, string[]>;
  sort: { field: string; direction: "asc" | "desc" };
  analysisMode: "all" | "analysis" | "aiAnalysis";
  pageOffset: number;
  pageLimit: number;
  pageTotal: number;
  pageRows: PageRow[];
};

export type DashboardAction =
  | {
      type: "stream/status";
      connection: ConnectionState;
      recordsReceived: number;
      totalExpected: number;
      lastSequence: number;
      errorMessage?: string;
    }
  | {
      type: "filters/set";
      search?: string;
      filters?: Record<string, string[]>;
      analysisMode?: DashboardState["analysisMode"];
    }
  | { type: "sort/set"; field: string; direction: "asc" | "desc" }
  | { type: "page/set"; offset: number; limit?: number }
  | { type: "page/result"; total: number; rows: PageRow[] };

const initialState: DashboardState = {
  connection: "idle",
  recordsReceived: 0,
  totalExpected: 0,
  lastSequence: 0,
  search: "",
  filters: {},
  sort: { field: "severity", direction: "desc" },
  analysisMode: "all",
  pageOffset: 0,
  pageLimit: 50,
  pageTotal: 0,
  pageRows: [],
};

function reducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "stream/status":
      return {
        ...state,
        connection: action.connection,
        recordsReceived: action.recordsReceived,
        totalExpected: action.totalExpected,
        lastSequence: action.lastSequence,
        errorMessage: action.errorMessage,
      };
    case "filters/set":
      return {
        ...state,
        search: action.search ?? state.search,
        filters: action.filters ?? state.filters,
        analysisMode: action.analysisMode ?? state.analysisMode,
        pageOffset: 0,
      };
    case "sort/set":
      return {
        ...state,
        sort: { field: action.field, direction: action.direction },
        pageOffset: 0,
      };
    case "page/set":
      return {
        ...state,
        pageOffset: action.offset,
        pageLimit: action.limit ?? state.pageLimit,
      };
    case "page/result":
      return {
        ...state,
        pageTotal: action.total,
        pageRows: action.rows,
      };
    default:
      return state;
  }
}

export type DashboardStore = ReturnType<typeof createDashboardStore>;

export function createDashboardStore() {
  const store = createStore(redux(reducer, initialState));

  // Cross-tab operational sync (connection progress + filters).
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("svd-dashboard-ops");
    store.subscribe((state, prev) => {
      if (
        state.recordsReceived !== prev.recordsReceived ||
        state.connection !== prev.connection ||
        state.search !== prev.search
      ) {
        channel.postMessage({
          type: "ops",
          connection: state.connection,
          recordsReceived: state.recordsReceived,
          totalExpected: state.totalExpected,
          search: state.search,
        });
      }
    });
    channel.onmessage = (event: MessageEvent<{ type: string } & Partial<DashboardState>>) => {
      if (event.data?.type !== "ops") return;
      store.dispatch({
        type: "stream/status",
        connection: (event.data.connection as ConnectionState) ?? store.getState().connection,
        recordsReceived: event.data.recordsReceived ?? store.getState().recordsReceived,
        totalExpected: event.data.totalExpected ?? store.getState().totalExpected,
        lastSequence: store.getState().lastSequence,
      });
    };
  }

  return store;
}
