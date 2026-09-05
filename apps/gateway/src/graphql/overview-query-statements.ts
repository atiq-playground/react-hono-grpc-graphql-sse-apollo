import { AI_ANALYSIS_EXCLUDED_KAI_STATUS, ANALYSIS_EXCLUDED_KAI_STATUS } from "@repo/shared";

import type { CompactQuery, OverviewQueryInput, QueryParameters } from "./findings-query.types.js";
import { compileWhere } from "./query-compiler.js";

const TOP_DIMENSION_LIMIT = 20;

function scopeWithSearch(input: OverviewQueryInput) {
  return { ...input, analysisMode: "all" as const, search: null };
}

export function buildOverviewCoreQuery(input: OverviewQueryInput): CompactQuery {
  const where = compileWhere(scopeWithSearch(input), { prefix: "overview_core" });
  return {
    query: `
      SELECT
        count() AS total,
        uniqExact(cve) AS uniqueCves,
        countIf(kaiStatus IS NULL OR kaiStatus != {analysis_excluded:String}) AS analysisCount,
        countIf(kaiStatus IS NULL OR kaiStatus != {ai_analysis_excluded:String}) AS aiAnalysisCount,
        ifNull(avgOrNull(cvss), 0) AS averageCvss,
        countIf(startsWith(lowerUTF8(status), {fixed_prefix:String})) AS fixedStatus,
        countIf(has(riskFactors, {has_fix_factor:String})) AS fixAvailable,
        uniqExactIf(cve, startsWith(lowerUTF8(status), {fixed_prefix:String})) AS fixedCves
      FROM findings FINAL
      WHERE ${where.sql}
    `,
    queryParams: {
      ...where.params,
      analysis_excluded: ANALYSIS_EXCLUDED_KAI_STATUS,
      ai_analysis_excluded: AI_ANALYSIS_EXCLUDED_KAI_STATUS,
      fixed_prefix: "fixed",
      has_fix_factor: "Has fix",
    },
    columns: [
      "total",
      "uniqueCves",
      "analysisCount",
      "aiAnalysisCount",
      "averageCvss",
      "fixedStatus",
      "fixAvailable",
      "fixedCves",
    ],
    maxResultRows: 1,
  };
}

interface DimensionBranch {
  readonly sql: string;
  readonly params: QueryParameters;
}

function buildScalarDimension(
  input: OverviewQueryInput,
  metric: string,
  column: "severity" | "repo" | "image" | "packageName",
  index: number,
): DimensionBranch {
  const prefix = `overview_dimension_${index}`;
  const where = compileWhere(scopeWithSearch(input), { prefix });
  return {
    sql: `
      SELECT {${prefix}_metric:String} AS metric, value AS key, value AS label, count
      FROM (
        SELECT toString({${prefix}_column:Identifier}) AS value, count() AS count
        FROM findings FINAL
        WHERE ${where.sql}
        GROUP BY value
        ORDER BY count DESC, value ASC
        LIMIT {${prefix}_limit:UInt8}
      )
    `,
    params: {
      ...where.params,
      [`${prefix}_metric`]: metric,
      [`${prefix}_column`]: column,
      [`${prefix}_limit`]: TOP_DIMENSION_LIMIT,
    },
  };
}

function buildRiskFactorDimension(input: OverviewQueryInput, index: number): DimensionBranch {
  const prefix = `overview_dimension_${index}`;
  const where = compileWhere(scopeWithSearch(input), { prefix });
  return {
    sql: `
      SELECT {${prefix}_metric:String} AS metric, value AS key, value AS label, count
      FROM (
        SELECT arrayJoin(riskFactors) AS value, count() AS count
        FROM findings FINAL
        WHERE ${where.sql}
        GROUP BY value
        ORDER BY count DESC, value ASC
        LIMIT {${prefix}_limit:UInt8}
      )
    `,
    params: {
      ...where.params,
      [`${prefix}_metric`]: "riskFactorDistribution",
      [`${prefix}_limit`]: TOP_DIMENSION_LIMIT,
    },
  };
}

export function buildOverviewDimensionsQuery(input: OverviewQueryInput): CompactQuery {
  const branches = [
    buildScalarDimension(input, "severityDistribution", "severity", 0),
    buildScalarDimension(input, "byRepository", "repo", 1),
    buildScalarDimension(input, "byImage", "image", 2),
    buildScalarDimension(input, "topPackages", "packageName", 3),
    buildRiskFactorDimension(input, 4),
  ];
  return {
    query: branches.map((branch) => branch.sql).join("\nUNION ALL\n"),
    queryParams: Object.assign({}, ...branches.map((branch) => branch.params)),
    columns: ["metric", "key", "label", "count"],
    maxResultRows: TOP_DIMENSION_LIMIT * branches.length,
  };
}

function temporalBranch(
  input: OverviewQueryInput,
  prefix: string,
  metric: string,
  keyExpression: string,
): DimensionBranch {
  const where = compileWhere(scopeWithSearch(input), { prefix });
  return {
    sql: `
      SELECT {${prefix}_metric:String} AS metric, bucket AS key, bucket AS label, count
      FROM (
        SELECT ${keyExpression} AS bucket, count() AS count
        FROM findings FINAL
        WHERE ${where.sql}
        GROUP BY bucket
      )
    `,
    params: {
      ...where.params,
      [`${prefix}_metric`]: metric,
    },
  };
}

export function buildOverviewTemporalQuery(input: OverviewQueryInput): CompactQuery {
  const age = temporalBranch(
    input,
    "overview_age",
    "ageBuckets",
    `multiIf(
      publishedAt IS NULL, 'unknown',
      publishedAt >= now() - INTERVAL 30 DAY, '0-30d',
      publishedAt >= now() - INTERVAL 90 DAY, '31-90d',
      publishedAt >= now() - INTERVAL 1 YEAR, '91-365d',
      publishedAt >= now() - INTERVAL 5 YEAR, '1-5y',
      '5y+'
    )`,
  );
  const timeToFix = temporalBranch(
    input,
    "overview_time_to_fix",
    "timeToFixBuckets",
    `multiIf(
      fixedAt IS NULL OR publishedAt IS NULL OR fixedAt <= publishedAt, 'unresolved',
      dateDiff('day', publishedAt, fixedAt) < 7, '0-6d',
      dateDiff('day', publishedAt, fixedAt) < 30, '7-29d',
      dateDiff('day', publishedAt, fixedAt) < 90, '30-89d',
      dateDiff('day', publishedAt, fixedAt) < 365, '90-364d',
      '1y+'
    )`,
  );
  const trendWhere = compileWhere(scopeWithSearch(input), { prefix: "overview_trend" });
  const trend: DimensionBranch = {
    sql: `
      SELECT {overview_trend_metric:String} AS metric, month AS key, month AS label, count
      FROM (
        SELECT formatDateTime(toStartOfMonth(publishedAt), '%Y-%m') AS month, count() AS count
        FROM findings FINAL
        WHERE ${trendWhere.sql}
          AND publishedAt IS NOT NULL
        GROUP BY month
        ORDER BY month ASC
        LIMIT {overview_trend_limit:UInt16}
      )
    `,
    params: {
      ...trendWhere.params,
      overview_trend_metric: "publishedTrend",
      overview_trend_limit: 600,
    },
  };
  const branches = [age, timeToFix, trend];
  return {
    query: branches.map((branch) => branch.sql).join("\nUNION ALL\n"),
    queryParams: Object.assign({}, ...branches.map((branch) => branch.params)),
    columns: ["metric", "key", "label", "count"],
    maxResultRows: 620,
  };
}
