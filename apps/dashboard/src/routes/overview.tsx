import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { exploreStateToSearch } from "../app/url-state";
import type { FacetsQuery, SummaryQuery } from "../graphql/generated";

const OVERVIEW = gql`
  query Overview {
    summary {
      total
      analysisCount
      aiAnalysisCount
      bySeverity {
        severity
        count
      }
    }
    facets {
      group {
        value
        count
      }
      repo {
        value
        count
      }
    }
  }
`;

const OverviewCharts = lazy(() =>
  import("../features/charts/OverviewCharts").then(({ OverviewCharts: Charts }) => ({
    default: Charts,
  })),
);

export function OverviewPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<SummaryQuery & FacetsQuery>(OVERVIEW);
  const summary = data?.summary;

  return (
    <section aria-labelledby="overview-heading">
      <h1 id="overview-heading" className="text-2xl font-semibold">
        Overview
      </h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm">
        Charts use GraphQL aggregates from ClickHouse. Exact kaiStatus exclusions power Analysis /
        AI Analysis.
      </p>
      {loading ? <p>Loading aggregates…</p> : null}
      {error ? (
        <p className="text-destructive text-sm">Gateway unavailable. Try again later.</p>
      ) : null}
      {summary ? (
        <Suspense
          fallback={
            <div
              className="min-h-[24rem] pt-2 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              Loading charts…
            </div>
          }
        >
          <OverviewCharts
            bySeverity={summary.bySeverity}
            total={summary.total}
            analysisCount={summary.analysisCount}
            aiAnalysisCount={summary.aiAnalysisCount}
            topGroups={(data?.facets?.group ?? []).slice(0, 8)}
            topRepos={(data?.facets?.repo ?? []).slice(0, 8)}
            onSeverityClick={(severity) => {
              navigate(
                `/explore?${exploreStateToSearch({
                  search: "",
                  filters: { severity: [severity] },
                  sort: { field: "severity", direction: "desc" },
                  analysisMode: "all",
                  pageOffset: 0,
                })}`,
              );
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
