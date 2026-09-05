import type { FindingFilters } from "@repo/shared";

import { type ExploreUrlState, exploreStateToSearch } from "../../app/url-state";
import { CvesFoundVsFixedCard } from "./CvesFoundVsFixedCard";
import {
  AgeBucketsCard,
  FixAvailabilityCard,
  RiskFactorDistributionCard,
  SeverityDistributionCard,
  StatusDistributionCard,
  TimeToFixBucketsCard,
} from "./DistributionCards";
import type { DataTableRow } from "./OverviewCard";
import type { VulnerabilityOverview } from "./overview.types";
import { PublishedTrendCard } from "./PublishedTrendCard";
import { SummaryMetricStrip } from "./SummaryMetricStrip";
import { ByImageCard, ByRepositoryCard, TopPackagesCard } from "./TopEntityCards";

type Props = {
  overview: VulnerabilityOverview;
  urlState: ExploreUrlState;
};

type DrillThroughField = Extract<keyof FindingFilters, "severity" | "repo">;

export function OverviewCharts({ overview, urlState }: Props) {
  const drillThroughHref = (field: DrillThroughField, row: DataTableRow) => {
    const search = exploreStateToSearch({
      ...urlState,
      filters: { ...urlState.filters, [field]: [row.key] },
      after: null,
    });
    return `/explore?${search}`;
  };

  return (
    <>
      <SummaryMetricStrip totals={overview.totals} />

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-12">
        <PublishedTrendCard
          buckets={overview.publishedTrend}
          className="lg:col-span-12 xl:col-span-8"
        />
        <CvesFoundVsFixedCard
          values={overview.cvesFoundVsFixed}
          className="lg:col-span-12 xl:col-span-4"
        />

        <SeverityDistributionCard
          buckets={overview.severityDistribution}
          getRowHref={(row) => drillThroughHref("severity", row)}
          className="lg:col-span-7"
        />
        <StatusDistributionCard buckets={overview.statusDistribution} className="lg:col-span-5" />

        <ByRepositoryCard
          buckets={overview.byRepository}
          getRowHref={(row) => drillThroughHref("repo", row)}
          className="lg:col-span-4"
        />
        <ByImageCard buckets={overview.byImage} className="lg:col-span-4" />
        <TopPackagesCard buckets={overview.topPackages} className="lg:col-span-4" />

        <RiskFactorDistributionCard
          buckets={overview.riskFactorDistribution}
          className="lg:col-span-6"
        />
        <AgeBucketsCard buckets={overview.ageBuckets} className="lg:col-span-6" />
        <FixAvailabilityCard buckets={overview.fixAvailability} className="lg:col-span-4" />
        <TimeToFixBucketsCard buckets={overview.timeToFixBuckets} className="lg:col-span-8" />
      </div>
    </>
  );
}

export default OverviewCharts;
