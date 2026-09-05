import { useApolloClient } from "@apollo/client/react";
import {
  DATASET_EVENT_TYPES,
  type DatasetEvent,
  type DatasetEventType,
  decodeDatasetEvent,
  type TimeRangePreset,
} from "@repo/shared";
import { useEffect, useRef } from "react";

import { useDashboardStore } from "../../app/dashboard-context";

const REFETCH_DEBOUNCE_MS = 300;

type RefetchScope = "findings" | "facets" | "overview";

const REFETCH_DOCUMENTS = {
  findings: "ExploreFindings",
  facets: "FindingFacets",
  overview: "VulnerabilityOverview",
} as const;

function writeCachedFinding(
  client: ReturnType<typeof useApolloClient>,
  typename: "FindingRow" | "FindingDetail",
  event: Extract<DatasetEvent, { type: "finding-upserted" }>,
): void {
  const id = client.cache.identify({ __typename: typename, id: event.finding.id });
  if (!id) return;
  const finding = event.finding;
  client.cache.modify({
    id,
    fields: {
      cve: () => finding.cve,
      severity: () => finding.severity,
      cvss: () => finding.cvss,
      status: () => finding.status,
      packageName: () => finding.packageName,
      packageVersion: () => finding.packageVersion,
      group: () => finding.group,
      repo: () => finding.repo,
      image: () => finding.image,
      kaiStatus: () => finding.kaiStatus,
      publishedAt: () => finding.publishedAt,
    },
  });
}

function removeCachedDetail(client: ReturnType<typeof useApolloClient>, findingId: string): void {
  client.cache.evict({ id: "ROOT_QUERY", fieldName: "finding", args: { id: findingId } });
  const id = client.cache.identify({ __typename: "FindingDetail", id: findingId });
  if (id) client.cache.evict({ id });
}

function removeVisibleFinding(client: ReturnType<typeof useApolloClient>, findingId: string): void {
  client.cache.modify({
    id: "ROOT_QUERY",
    fields: {
      findings(existing, { readField }) {
        if (!existing || !Array.isArray(existing.edges)) return existing;
        const edges = existing.edges.filter((edge: unknown) => {
          const node = readField("node", edge as never);
          return readField("id", node as never) !== findingId;
        });
        return edges.length === existing.edges.length ? existing : { ...existing, edges };
      },
    },
  });

  const id = client.cache.identify({ __typename: "FindingRow", id: findingId });
  if (id) client.cache.evict({ id });
}

function scopesForEvent(event: DatasetEvent): readonly RefetchScope[] {
  switch (event.type) {
    case "aggregates-invalidated":
      return event.scopes;
    case "finding-upserted":
    case "finding-deleted":
    case "findings-changed":
    case "dataset-version-changed":
      return ["findings", "facets", "overview"];
    default:
      return [];
  }
}

function isDataChange(event: DatasetEvent): boolean {
  return (
    event.type === "finding-upserted" ||
    event.type === "finding-deleted" ||
    event.type === "findings-changed" ||
    event.type === "aggregates-invalidated" ||
    event.type === "dataset-version-changed"
  );
}

/**
 * Owns the app-wide native EventSource. Its `lastEventId` is display state:
 * browsers attach Last-Event-ID only for automatic reconnects of this instance,
 * and EventSource cannot set that header to resume after a page reload.
 */
export function useDatasetEvents(timeRangePreset: TimeRangePreset): void {
  const client = useApolloClient();
  const store = useDashboardStore();
  const timeRangeRef = useRef(timeRangePreset);

  useEffect(() => {
    timeRangeRef.current = timeRangePreset;
  }, [timeRangePreset]);

  useEffect(() => {
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const pendingScopes = new Set<RefetchScope>();

    const scheduleRefetch = (scopes: readonly RefetchScope[]) => {
      for (const scope of scopes) pendingScopes.add(scope);
      if (refetchTimer !== undefined) return;
      refetchTimer = setTimeout(() => {
        refetchTimer = undefined;
        const include = [...pendingScopes].map((scope) => REFETCH_DOCUMENTS[scope]);
        pendingScopes.clear();
        if (include.length > 0) void client.refetchQueries({ include });
      }, REFETCH_DEBOUNCE_MS);
    };

    const source = new EventSource("/api/stream");
    store.getState().setConnection("connecting");
    if (source.readyState === EventSource.OPEN) {
      store.getState().setConnection("open");
    }

    source.onopen = () => {
      if (cancelled) return;
      store.getState().setConnection("open");
    };
    source.onerror = () => {
      if (cancelled) return;
      const connection = source.readyState === EventSource.CLOSED ? "closed" : "reconnecting";
      store.getState().setConnection(connection, "Live connection interrupted");
    };

    const handleMessage = (expectedType: DatasetEventType, message: MessageEvent<string>) => {
      if (cancelled) return;
      try {
        const event = decodeDatasetEvent(message.data);
        if (event.type !== expectedType) {
          throw new Error(`DatasetEvent type mismatch: expected ${expectedType}`);
        }
        if (message.lastEventId) store.getState().recordEvent(message.lastEventId);

        if (event.type === "resync-required") {
          store.getState().resetPendingUpdates();
          void client.reFetchObservableQueries();
          return;
        }

        if (event.type === "finding-upserted") {
          writeCachedFinding(client, "FindingDetail", event);
          store
            .getState()
            .recordFindingEvent({ id: event.finding.id, type: "upserted", at: event.at });
        }
        if (event.type === "finding-deleted") {
          removeCachedDetail(client, event.id);
          store.getState().recordFindingEvent({ id: event.id, type: "deleted", at: event.at });
        }

        if (timeRangeRef.current !== "live" && isDataChange(event)) {
          store
            .getState()
            .incrementPendingUpdates(event.type === "findings-changed" ? event.ids.length : 1);
          return;
        }

        if (event.type === "finding-upserted") writeCachedFinding(client, "FindingRow", event);
        if (event.type === "finding-deleted") removeVisibleFinding(client, event.id);
        scheduleRefetch(scopesForEvent(event));
      } catch (error: unknown) {
        // Keep the connection alive; never log the untrusted event payload.
        console.warn(
          "Rejected malformed DatasetEvent",
          error instanceof Error ? error.message : "unknown validation error",
        );
      }
    };

    const listeners = DATASET_EVENT_TYPES.map((type) => {
      const listener = (event: Event) => handleMessage(type, event as MessageEvent<string>);
      source.addEventListener(type, listener);
      return [type, listener] as const;
    });

    return () => {
      cancelled = true;
      if (refetchTimer !== undefined) clearTimeout(refetchTimer);
      for (const [type, listener] of listeners) source.removeEventListener(type, listener);
      source.close();
      store.getState().setConnection("closed");
    };
  }, [client, store]);
}

/** Refetches active bounded views, then acknowledges windowed pending updates. */
export function useRefreshPendingUpdates(): () => Promise<void> {
  const client = useApolloClient();
  const store = useDashboardStore();

  return async () => {
    await client.refetchQueries({
      include: ["ExploreFindings", "FindingFacets", "VulnerabilityOverview"],
    });
    store.getState().resetPendingUpdates();
  };
}
