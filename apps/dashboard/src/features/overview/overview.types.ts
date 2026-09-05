import type { VulnerabilityOverviewQuery } from "../../graphql/__generated__/graphql";

export type VulnerabilityOverview = VulnerabilityOverviewQuery["vulnerabilityOverview"];
export type OverviewTotals = VulnerabilityOverview["totals"];
export type OverviewBucket = VulnerabilityOverview["severityDistribution"][number];
export type PublishedTrendBucket = VulnerabilityOverview["publishedTrend"][number];
