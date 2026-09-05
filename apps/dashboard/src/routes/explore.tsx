import type { FindingFilters, FindingSort } from "@repo/shared";
import { Button } from "@repo/ui/components/ui/button";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useStore } from "zustand";

import { useDashboardStore } from "../app/dashboard-context";
import { exploreStateToSearch, parseExploreSearch } from "../app/url-state";
import { ExploreFilters } from "../features/explore/ExploreFilters";
import {
  FindingsEmptyState,
  FindingsErrorState,
  FindingsLoadingState,
} from "../features/explore/ExploreResultsState";
import { FindingsGrid } from "../features/explore/FindingsGrid";
import { useFacets } from "../features/explore/use-facets";
import { useFindingsConnection } from "../features/explore/use-findings-connection";
import { useRefreshPendingUpdates } from "../features/live/use-dataset-events";

export function ExplorePage() {
  const store = useDashboardStore();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseExploreSearch(params), [params]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const pendingUpdates = useStore(store, (value) => value.pendingUpdates);
  const findings = useFindingsConnection(state);
  const facets = useFacets(state);
  const refreshPendingUpdates = useRefreshPendingUpdates();
  const edges = findings.data?.findings.edges ?? [];
  const nodes = edges.map((edge) => edge.node);
  const totalCount = findings.data?.findings.totalCount ?? 0;

  const setUrlState = useCallback(
    (next: typeof state, replace = false) => {
      setParams(exploreStateToSearch(next), { replace });
    },
    [setParams],
  );

  const handleFiltersChange = useCallback(
    (filters: FindingFilters) => setUrlState({ ...state, filters, after: null }),
    [setUrlState, state],
  );
  const handleSortChange = useCallback(
    (sort: FindingSort) => setUrlState({ ...state, sort, after: null }),
    [setUrlState, state],
  );
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await refreshPendingUpdates();
    } catch {
      setRefreshError("Updates could not be refreshed");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshPendingUpdates]);

  const showRefresh = state.timeRange.preset !== "live" && pendingUpdates > 0;

  return (
    <section aria-labelledby="explore-heading" className="space-y-5">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          ClickHouse-backed exploration
        </p>
        <h1 id="explore-heading" className="mt-1 text-2xl font-semibold">
          Vulnerability findings
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Search and refine the result set without loading the full dataset into this browser.
        </p>
      </header>

      {showRefresh && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            {isRefreshing && (
              <span
                className="size-2 animate-pulse rounded-full bg-foreground"
                aria-hidden="true"
              />
            )}
            {pendingUpdates.toLocaleString()} updates — Refresh
          </Button>
        </div>
      )}
      {refreshError && (
        <p className="text-sm text-destructive" role="status">
          {refreshError}
        </p>
      )}

      <div className="rounded-lg border bg-card p-3">
        <ExploreFilters
          filters={state.filters}
          facets={facets.data?.facets}
          isLoading={facets.loading}
          onFiltersChange={handleFiltersChange}
        />
        {facets.error && (
          <p className="mt-2 text-xs text-destructive" role="status">
            Filter counts are temporarily unavailable.
          </p>
        )}
      </div>

      {findings.loading && edges.length === 0 && <FindingsLoadingState />}
      {findings.error && edges.length === 0 && (
        <FindingsErrorState onRetry={() => void findings.refetch()} />
      )}
      {!findings.loading && !findings.error && edges.length === 0 && <FindingsEmptyState />}
      {edges.length > 0 && (
        <FindingsGrid
          findings={nodes}
          loadedCount={findings.loadedCount}
          totalCount={totalCount}
          sort={state.sort}
          hasNextPage={findings.hasNextPage}
          isFetchingMore={findings.isFetchingMore}
          loadMoreError={findings.loadMoreError}
          onSortChange={handleSortChange}
          onLoadMore={findings.loadMore}
        />
      )}
    </section>
  );
}
