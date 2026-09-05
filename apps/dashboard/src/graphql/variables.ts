import type { AnalysisMode, FindingSort, TimeRangeInput } from "@repo/shared";

import type { ExploreUrlState } from "../app/url-state";
import type {
  ExploreFindingsQueryVariables,
  ExportInput,
  FindingSortField,
  FindingSortInput,
  AnalysisMode as GraphqlAnalysisMode,
  TimeRangeInput as GraphqlTimeRangeInput,
  TimeRangePreset,
} from "./__generated__/graphql";

const ANALYSIS_MODE: Readonly<Record<AnalysisMode, GraphqlAnalysisMode>> = {
  all: "ALL",
  analysis: "ANALYSIS",
  aiAnalysis: "AI_ANALYSIS",
};

const SORT_FIELD: Readonly<Record<FindingSort["field"], FindingSortField>> = {
  cvss: "CVSS",
  severity: "SEVERITY",
  cve: "CVE",
  publishedAt: "PUBLISHED_AT",
  fixedAt: "FIXED_AT",
  packageName: "PACKAGE_NAME",
  repo: "REPO",
  updatedAt: "UPDATED_AT",
};

const TIME_RANGE_PRESET: Readonly<Record<TimeRangeInput["preset"], TimeRangePreset>> = {
  live: "LIVE",
  "24h": "LAST_24_HOURS",
  "7d": "LAST_7_DAYS",
  "30d": "LAST_30_DAYS",
  "1y": "LAST_1_YEAR",
  "5y": "LAST_5_YEARS",
  custom: "CUSTOM",
};

export function toGraphqlAnalysisMode(mode: AnalysisMode): GraphqlAnalysisMode {
  return ANALYSIS_MODE[mode];
}

export function toGraphqlSort(sort: FindingSort): FindingSortInput {
  return {
    field: SORT_FIELD[sort.field],
    direction: sort.direction === "asc" ? "ASC" : "DESC",
  };
}

export function toGraphqlTimeRange(timeRange: TimeRangeInput): GraphqlTimeRangeInput {
  return {
    preset: TIME_RANGE_PRESET[timeRange.preset],
    ...(timeRange.preset === "custom" ? { from: timeRange.from, to: timeRange.to } : {}),
  };
}

export function toExploreFindingsVariables(
  state: ExploreUrlState,
  first = 50,
): ExploreFindingsQueryVariables {
  return {
    filters: state.filters,
    sort: toGraphqlSort(state.sort),
    search: state.search || undefined,
    timeRange: toGraphqlTimeRange(state.timeRange),
    analysisMode: toGraphqlAnalysisMode(state.analysisMode),
    after: state.after ?? undefined,
    first,
  };
}

export function toExportInput(state: ExploreUrlState): ExportInput {
  return {
    filters: state.filters,
    sort: toGraphqlSort(state.sort),
    search: state.search || undefined,
    timeRange: toGraphqlTimeRange(state.timeRange),
    analysisMode: toGraphqlAnalysisMode(state.analysisMode),
  };
}
