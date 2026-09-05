/// <reference types="jest" />

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { encodeDatasetEvent, type TimeRangePreset } from "@repo/shared";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";

import { StoreContext } from "../../app/dashboard-context";
import { createDashboardStore } from "../../state/dashboard-store";
import { useDatasetEvents } from "./use-dataset-events";

const ID = "0123456789abcdef0123456789abcdef";
const finding = {
  id: ID,
  cve: "CVE-2026-0001",
  severity: "high",
  cvss: 8.2,
  status: "open",
  packageName: "safe-package",
  packageVersion: "1.0.0",
  group: "platform",
  repo: "dashboard",
  image: "registry.example/dashboard:1",
  kaiStatus: null,
  publishedAt: "2026-09-05T12:00:00.000Z",
} as const;
const base = {
  v: 1 as const,
  datasetVersion: "qa-1",
  at: "2026-09-05T12:30:00.000Z",
};

class MockEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly withCredentials = false;
  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, data: string, lastEventId = "1-0"): void {
    this.dispatchEvent(new MessageEvent(type, { data, lastEventId }));
  }
}

function Harness({ preset }: { preset: TimeRangePreset }) {
  useDatasetEvents(preset);
  return null;
}

function createFixture(preset: TimeRangePreset, store = createDashboardStore()) {
  const cache = new InMemoryCache({
    typePolicies: {
      FindingRow: { keyFields: ["id"] },
      FindingDetail: { keyFields: ["id"] },
    },
  });
  const client = new ApolloClient({ cache, link: ApolloLink.empty() });
  const fragment = gql`
    fragment LiveFinding on FindingRow {
      id
      cve
      severity
      cvss
      status
      packageName
      packageVersion
      group
      repo
      image
      kaiStatus
      publishedAt
    }
  `;
  cache.writeFragment({
    id: cache.identify({ __typename: "FindingRow", id: ID }),
    fragment,
    data: { __typename: "FindingRow", ...finding, severity: "low", cvss: 2.1 },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    </ApolloProvider>
  );
  render(<Harness preset={preset} />, { wrapper: Wrapper });
  const source = MockEventSource.instances.at(-1);
  if (!source) throw new Error("EventSource was not created");
  return { cache, client, fragment, source, store };
}

describe("DatasetEvent live handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: MockEventSource,
    });
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("applies a Live upsert, records it, and coalesces bounded refetches", async () => {
    const { cache, client, fragment, source, store } = createFixture("live");
    const refetch = jest.spyOn(client, "refetchQueries").mockResolvedValue([]);

    act(() => {
      source.emit(
        "finding-upserted",
        encodeDatasetEvent({ ...base, type: "finding-upserted", finding }),
        "10-1",
      );
    });

    expect(
      cache.readFragment<{ severity: string; cvss: number }>({
        id: cache.identify({ __typename: "FindingRow", id: ID }),
        fragment,
      }),
    ).toMatchObject({ severity: "high", cvss: 8.2 });
    expect(store.getState()).toMatchObject({
      lastEventId: "10-1",
      pendingUpdates: 0,
      recentFindingEvents: [{ id: ID, type: "upserted", at: base.at }],
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({
      include: ["ExploreFindings", "FindingFacets", "VulnerabilityOverview"],
    });
  });

  it("keeps windowed rows stable and counts pending changes deterministically", () => {
    const { cache, client, fragment, source, store } = createFixture("7d");
    const refetch = jest.spyOn(client, "refetchQueries").mockResolvedValue([]);

    act(() => {
      source.emit(
        "findings-changed",
        encodeDatasetEvent({ ...base, type: "findings-changed", ids: [ID, "a".repeat(32)] }),
      );
      source.emit(
        "finding-upserted",
        encodeDatasetEvent({ ...base, type: "finding-upserted", finding }),
      );
      jest.advanceTimersByTime(300);
    });

    expect(
      cache.readFragment<{ severity: string }>({
        id: cache.identify({ __typename: "FindingRow", id: ID }),
        fragment,
      }),
    ).toMatchObject({ severity: "low" });
    expect(store.getState().pendingUpdates).toBe(3);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("forces observable queries to resynchronize and clears pending state", () => {
    const { client, source, store } = createFixture("30d");
    store.getState().incrementPendingUpdates(4);
    const reFetch = jest.spyOn(client, "reFetchObservableQueries").mockResolvedValue([]);

    act(() => {
      source.emit(
        "resync-required",
        encodeDatasetEvent({ ...base, type: "resync-required" }),
        "20-0",
      );
    });

    expect(store.getState().pendingUpdates).toBe(0);
    expect(store.getState().lastEventId).toBe("20-0");
    expect(reFetch).toHaveBeenCalledTimes(1);
  });

  it("marks the stream open and ignores a closed EventSource after remount", () => {
    const store = createDashboardStore();
    const first = createFixture("live", store);
    expect(store.getState().connection).toBe("connecting");

    act(() => {
      first.source.readyState = MockEventSource.OPEN;
      first.source.onopen?.(new Event("open"));
    });
    expect(store.getState().connection).toBe("open");

    cleanup();
    expect(store.getState().connection).toBe("closed");
    expect(first.source.readyState).toBe(MockEventSource.CLOSED);

    const second = createFixture("live", store);
    expect(store.getState().connection).toBe("connecting");

    act(() => {
      first.source.onerror?.(new Event("error"));
    });
    expect(store.getState().connection).toBe("connecting");

    act(() => {
      second.source.readyState = MockEventSource.OPEN;
      second.source.onopen?.(new Event("open"));
    });
    expect(store.getState().connection).toBe("open");
  });
});
