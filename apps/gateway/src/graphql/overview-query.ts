import type { ClickHouseClient } from "@clickhouse/client";

import { queryCompactRows } from "./clickhouse.js";
import type {
  OverviewBucket,
  OverviewQueryInput,
  VulnerabilityOverviewResult,
} from "./findings-query.types.js";
import {
  buildOverviewCoreQuery,
  buildOverviewDimensionsQuery,
  buildOverviewTemporalQuery,
} from "./overview-query-statements.js";

function bucket(row: Readonly<Record<string, unknown>>): OverviewBucket {
  return {
    key: String(row.key),
    label: String(row.label),
    count: Number(row.count),
  };
}

function orderedBuckets(
  buckets: readonly OverviewBucket[],
  order: readonly string[],
): readonly OverviewBucket[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...buckets].sort(
    (left, right) => (rank.get(left.key) ?? order.length) - (rank.get(right.key) ?? order.length),
  );
}

export async function findVulnerabilityOverview(
  ch: ClickHouseClient,
  input: OverviewQueryInput,
): Promise<VulnerabilityOverviewResult> {
  const [coreRows, dimensionRows, temporalRows] = await Promise.all([
    queryCompactRows(ch, buildOverviewCoreQuery(input)),
    queryCompactRows(ch, buildOverviewDimensionsQuery(input)),
    queryCompactRows(ch, buildOverviewTemporalQuery(input)),
  ]);
  const core = coreRows[0];
  if (core === undefined) throw new Error("ClickHouse overview query returned no totals");

  const grouped = new Map<string, OverviewBucket[]>();
  for (const row of [...dimensionRows, ...temporalRows]) {
    const metric = String(row.metric);
    grouped.set(metric, [...(grouped.get(metric) ?? []), bucket(row)]);
  }

  const total = Number(core.total);
  const fixedStatus = Number(core.fixedStatus);
  const fixAvailable = Number(core.fixAvailable);
  return {
    totals: {
      total,
      uniqueCves: Number(core.uniqueCves),
      analysisCount: Number(core.analysisCount),
      aiAnalysisCount: Number(core.aiAnalysisCount),
      averageCvss: Number(core.averageCvss),
    },
    severityDistribution: grouped.get("severityDistribution") ?? [],
    statusDistribution: [
      { key: "open", label: "Open", count: total - fixedStatus },
      { key: "fixed", label: "Fixed", count: fixedStatus },
    ],
    byRepository: grouped.get("byRepository") ?? [],
    byImage: grouped.get("byImage") ?? [],
    topPackages: grouped.get("topPackages") ?? [],
    riskFactorDistribution: grouped.get("riskFactorDistribution") ?? [],
    ageBuckets: orderedBuckets(grouped.get("ageBuckets") ?? [], [
      "0-30d",
      "31-90d",
      "91-365d",
      "1-5y",
      "5y+",
      "unknown",
    ]),
    fixAvailability: [
      { key: "available", label: "Fix available", count: fixAvailable },
      { key: "unavailable", label: "No fix available", count: total - fixAvailable },
    ],
    cvesFoundVsFixed: {
      found: Number(core.uniqueCves),
      fixed: Number(core.fixedCves),
    },
    timeToFixBuckets: orderedBuckets(grouped.get("timeToFixBuckets") ?? [], [
      "0-6d",
      "7-29d",
      "30-89d",
      "90-364d",
      "1y+",
      "unresolved",
    ]),
    publishedTrend: (grouped.get("publishedTrend") ?? []).map(({ key, count }) => ({
      month: key,
      count,
    })),
  };
}
