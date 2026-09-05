import {
  type AnalysisMode,
  AnalysisModeSchema,
  type FindingFilters,
  type TimeRangeInput,
} from "@repo/shared";

import {
  DEFAULT_EXPLORE_URL_STATE,
  exploreStateToSearch,
  parseExploreSearch,
} from "../../app/url-state";

export interface CompareUrlState {
  search: string;
  filters: FindingFilters;
  timeRange: TimeRangeInput;
  left: AnalysisMode;
  right: AnalysisMode;
  compared: boolean;
}

export const DEFAULT_COMPARE_URL_STATE: CompareUrlState = {
  search: DEFAULT_EXPLORE_URL_STATE.search,
  filters: {},
  timeRange: { preset: "live" },
  left: "analysis",
  right: "aiAnalysis",
  compared: false,
};

export function parseCompareSearch(params: URLSearchParams): CompareUrlState {
  const explore = parseExploreSearch(params);
  const left = AnalysisModeSchema.safeParse(params.get("left") ?? DEFAULT_COMPARE_URL_STATE.left);
  const right = AnalysisModeSchema.safeParse(
    params.get("right") ?? DEFAULT_COMPARE_URL_STATE.right,
  );

  return {
    search: explore.search,
    filters: explore.filters,
    timeRange: explore.timeRange,
    left: left.success ? left.data : DEFAULT_COMPARE_URL_STATE.left,
    right: right.success ? right.data : DEFAULT_COMPARE_URL_STATE.right,
    compared: params.get("compared") === "1",
  };
}

export function compareStateToSearch(state: CompareUrlState): string {
  const params = new URLSearchParams(
    exploreStateToSearch({
      ...DEFAULT_EXPLORE_URL_STATE,
      search: state.search,
      filters: state.filters,
      timeRange: state.timeRange,
    }),
  );
  params.delete("sort");
  params.delete("dir");
  params.delete("mode");
  params.delete("after");
  params.set("left", state.left);
  params.set("right", state.right);
  if (state.compared) params.set("compared", "1");
  return params.toString();
}
