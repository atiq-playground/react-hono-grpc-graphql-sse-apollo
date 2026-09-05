import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useStore } from "zustand";

import { useDashboardStore } from "../app/dashboard-context";
import { PageHeader } from "../app/page-header";
import { exploreStateToSearch, parseExploreSearch } from "../app/url-state";
import { useRefreshPendingUpdates } from "../features/live/use-dataset-events";
import OverviewCharts from "../features/overview/OverviewCharts";
import { OverviewToolbar } from "../features/overview/OverviewToolbar";
import { useVulnerabilityOverview } from "../features/overview/use-vulnerability-overview";

function OverviewLoading() {
  return (
    <div className="mt-6 space-y-5" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Loading vulnerability overview aggregates…</span>
      <Card className="gap-4 py-4 shadow-none">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={`metric-${index.toString()}`} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={`chart-${index.toString()}`} className="gap-4 py-5">
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function OverviewPage() {
  const store = useDashboardStore();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseExploreSearch(params), [params]);
  const pendingUpdates = useStore(store, (value) => value.pendingUpdates);
  const { data, dataState, loading, error, refetch } = useVulnerabilityOverview(
    state.filters,
    state.timeRange,
  );
  const refreshPendingUpdates = useRefreshPendingUpdates();
  const overview = dataState === "complete" ? data.vulnerabilityOverview : undefined;

  return (
    <section aria-labelledby="overview-heading">
      <PageHeader
        headingId="overview-heading"
        eyebrow="ClickHouse aggregate view"
        title="Vulnerability overview"
        description="Pre-aggregated exposure, remediation, and publication signals. No page-level findings are scanned or summarized in the browser."
      >
        <OverviewToolbar
          state={state}
          pendingUpdates={pendingUpdates}
          onStateChange={(nextState) => setParams(exploreStateToSearch(nextState))}
          onRefresh={refreshPendingUpdates}
        />
      </PageHeader>

      {loading && !overview && <OverviewLoading />}

      {error && !overview && (
        <Card className="mt-6 border-destructive/40 shadow-none" role="alert">
          <CardContent className="flex flex-col items-start gap-3">
            <div>
              <h2 className="font-semibold">Unable to load overview aggregates</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The bounded GraphQL overview request did not complete.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {overview && <OverviewCharts overview={overview} urlState={state} />}
    </section>
  );
}
