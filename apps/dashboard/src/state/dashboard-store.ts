import { createStore } from "zustand/vanilla";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export type FindingLiveEvent = {
  readonly id: string;
  readonly type: "upserted" | "deleted";
  readonly at: string;
};

const RECENT_FINDING_EVENT_CAP = 100;

export interface DashboardState {
  connection: LiveConnectionState;
  error: string | null;
  /**
   * Operational display only. Native EventSource sends Last-Event-ID while
   * reconnecting this instance; this value cannot restore replay after reload.
   */
  lastEventId: string | null;
  pendingUpdates: number;
  recentFindingEvents: readonly FindingLiveEvent[];
  setConnection: (connection: LiveConnectionState, error?: string | null) => void;
  recordEvent: (lastEventId: string | null) => void;
  recordFindingEvent: (event: FindingLiveEvent) => void;
  incrementPendingUpdates: (count?: number) => void;
  resetPendingUpdates: () => void;
}

const initialState = {
  connection: "idle",
  error: null,
  lastEventId: null,
  pendingUpdates: 0,
  recentFindingEvents: [],
} as const;

export type DashboardStore = ReturnType<typeof createDashboardStore>;

export function createDashboardStore() {
  return createStore<DashboardState>((set) => ({
    ...initialState,
    setConnection: (connection, error = null) => set({ connection, error }),
    recordEvent: (lastEventId) => set({ lastEventId }),
    recordFindingEvent: (event) =>
      set((state) => ({
        recentFindingEvents: [
          ...state.recentFindingEvents.filter(({ id }) => id !== event.id),
          event,
        ].slice(-RECENT_FINDING_EVENT_CAP),
      })),
    incrementPendingUpdates: (count = 1) =>
      set((state) => ({ pendingUpdates: state.pendingUpdates + Math.max(0, count) })),
    resetPendingUpdates: () => set({ pendingUpdates: 0 }),
  }));
}
