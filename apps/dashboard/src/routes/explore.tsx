import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { Button, Input } from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useStore } from "zustand";
import { useDashboardStore } from "../app/providers";
import { exploreStateToSearch, parseExploreSearch } from "../app/url-state";
import { VirtualizedFindingsGrid } from "../features/grid/VirtualizedFindingsGrid";
import type { FacetsQuery, StreamDescriptorQuery } from "../graphql/generated";
import { createQueryWorker, type QueryWorkerHandle } from "../query-worker/bridge";
import type { PageRow } from "../state/dashboard-store";

const STREAM_AND_FACETS = gql`
  query ExploreBootstrap {
    streamDescriptor {
      datasetVersion
      totalRecords
      ssePath
    }
    facets {
      severity {
        value
        count
      }
    }
  }
`;

export function ExplorePage() {
  const store = useDashboardStore();
  const [params, setParams] = useSearchParams();
  const pageRows = useStore(store, (s) => s.pageRows);
  const pageTotal = useStore(store, (s) => s.pageTotal);
  const pageOffset = useStore(store, (s) => s.pageOffset);
  const recordsReceived = useStore(store, (s) => s.recordsReceived);
  const totalExpected = useStore(store, (s) => s.totalExpected);
  const connection = useStore(store, (s) => s.connection);
  const search = useStore(store, (s) => s.search);
  const filters = useStore(store, (s) => s.filters);
  const sort = useStore(store, (s) => s.sort);
  const analysisMode = useStore(store, (s) => s.analysisMode);

  const urlState = useMemo(() => parseExploreSearch(params), [params]);
  const workerRef = useRef<QueryWorkerHandle | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rowCache, setRowCache] = useState<Map<number, PageRow>>(() => new Map());

  const { data, error: gqlError } = useQuery<StreamDescriptorQuery & FacetsQuery>(
    STREAM_AND_FACETS,
  );

  useEffect(() => {
    store.dispatch({
      type: "filters/set",
      search: urlState.search,
      filters: urlState.filters,
      analysisMode: urlState.analysisMode,
    });
    store.dispatch({
      type: "sort/set",
      field: urlState.sort.field,
      direction: urlState.sort.direction,
    });
    store.dispatch({ type: "page/set", offset: urlState.pageOffset });
  }, [store, urlState]);

  useEffect(() => {
    const worker = createQueryWorker(store);
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [store]);

  useEffect(() => {
    const descriptor = data?.streamDescriptor;
    const worker = workerRef.current;
    if (!descriptor || !worker) return;
    const sseUrl = `${descriptor.ssePath}?datasetVersion=${encodeURIComponent(descriptor.datasetVersion)}`;
    worker.startStream(sseUrl, descriptor.totalRecords);
  }, [data?.streamDescriptor]);

  const runQuery = useCallback(
    async (offset: number, limit: number) => {
      const worker = workerRef.current;
      if (!worker) return;
      store.dispatch({ type: "page/set", offset, limit });
      try {
        const result = await worker.query({
          search,
          filters,
          sort,
          offset,
          limit,
          analysisMode,
        });
        setRowCache((prev) => {
          const next = new Map(prev);
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            if (row) next.set(offset + i, row);
          }
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "superseded") return;
      }
    },
    [store, search, filters, sort, analysisMode],
  );

  // Re-query as the worker index grows during SSE ingest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recordsReceived drives refresh during stream
  useEffect(() => {
    void runQuery(pageOffset, 50);
  }, [runQuery, pageOffset, recordsReceived]);

  const onVisibleRange = useCallback(
    (offset: number, limit: number) => {
      if (offset !== pageOffset) {
        store.dispatch({ type: "page/set", offset, limit });
      } else {
        void runQuery(offset, limit);
      }
    },
    [pageOffset, runQuery, store],
  );

  const onSort = (field: string) => {
    const direction: "asc" | "desc" =
      sort.field === field && sort.direction === "desc" ? "asc" : "desc";
    const next = { ...urlState, sort: { field, direction }, pageOffset: 0 };
    store.dispatch({ type: "sort/set", field, direction });
    setParams(exploreStateToSearch(next));
    setRowCache(new Map());
  };

  const exportCsv = async () => {
    const worker = workerRef.current;
    if (!worker) return;
    const blob = await worker.exportCsv({ search, filters, sort, analysisMode });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "findings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="explore-heading">
      <h1 id="explore-heading" className="text-2xl font-semibold">
        Explore
      </h1>
      <p className="text-muted-foreground mt-2 text-sm" aria-live="polite">
        Stream: {connection}
        {totalExpected > 0
          ? ` — ${recordsReceived.toLocaleString()} / ${totalExpected.toLocaleString()} indexed`
          : ` — ${recordsReceived.toLocaleString()} rows indexed`}
        . Result set: {pageTotal.toLocaleString()}.
      </p>
      {gqlError ? (
        <p className="text-destructive mt-2 text-sm">Gateway unavailable: {gqlError.message}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm" htmlFor="explore-search">
          Search
          <Input
            id="explore-search"
            className="mt-1 w-72"
            value={search}
            list="search-suggestions"
            onChange={(event) => {
              const value = event.target.value;
              const next = { ...urlState, search: value, pageOffset: 0 };
              store.dispatch({ type: "filters/set", search: value });
              setParams(exploreStateToSearch(next));
              setRowCache(new Map());
              void workerRef.current
                ?.suggest(value)
                .then(setSuggestions)
                .catch(() => undefined);
            }}
          />
          <datalist id="search-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm" htmlFor="explore-severity">
          Severity
          <select
            id="explore-severity"
            className="mt-1 block rounded border px-2 py-1"
            value={filters.severity?.[0] ?? ""}
            onChange={(event) => {
              const severity = event.target.value;
              const nextFilters: Record<string, string[]> = severity
                ? { severity: [severity] }
                : {};
              const next = { ...urlState, filters: nextFilters, pageOffset: 0 };
              store.dispatch({ type: "filters/set", filters: nextFilters });
              setParams(exploreStateToSearch(next));
              setRowCache(new Map());
            }}
          >
            <option value="">All</option>
            {(data?.facets?.severity ?? []).map((f) => (
              <option key={f.value} value={f.value}>
                {f.value} ({f.count})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm" htmlFor="explore-mode">
          Mode
          <select
            id="explore-mode"
            className="mt-1 block rounded border px-2 py-1"
            value={analysisMode}
            onChange={(event) => {
              const mode = event.target.value as typeof analysisMode;
              const next = { ...urlState, analysisMode: mode, pageOffset: 0 };
              store.dispatch({ type: "filters/set", analysisMode: mode });
              setParams(exploreStateToSearch(next));
              setRowCache(new Map());
            }}
          >
            <option value="all">All</option>
            <option value="analysis">Analysis</option>
            <option value="aiAnalysis">AI Analysis</option>
          </select>
        </label>

        <Button type="button" variant="outline" onClick={() => void exportCsv()}>
          Export CSV
        </Button>
      </div>

      <div className="mt-4">
        <VirtualizedFindingsGrid
          rowByIndex={
            rowCache.size > 0 ? rowCache : new Map(pageRows.map((r, i) => [pageOffset + i, r]))
          }
          total={pageTotal}
          onVisibleRange={onVisibleRange}
          onSort={onSort}
          sortField={sort.field}
          sortDirection={sort.direction}
        />
      </div>
    </section>
  );
}
