import {
  type AnalysisMode,
  AnalysisModeSchema,
  type FindingCursor,
  FindingCursorSchema,
  type FindingFilters,
  FindingFiltersSchema,
  type FindingSort,
  FindingSortSchema,
  type TimeRangeInput,
  TimeRangeInputSchema,
  TimeRangePresetSchema,
} from "@repo/shared";
import { z } from "zod/mini";

const FILTER_PARAMS = ["severity", "status", "repo", "group", "packageType"] as const;

// [schemas]

const SearchSchema = z.string().check(z.maxLength(256));

// [types]

export interface ExploreUrlState {
  search: string;
  filters: FindingFilters;
  sort: FindingSort;
  analysisMode: AnalysisMode;
  timeRange: TimeRangeInput;
  after: FindingCursor | null;
}

export const DEFAULT_EXPLORE_URL_STATE: ExploreUrlState = {
  search: "",
  filters: {},
  sort: { field: "severity", direction: "desc" },
  analysisMode: "all",
  timeRange: { preset: "live" },
  after: null,
};

function splitFilterValues(params: URLSearchParams, key: (typeof FILTER_PARAMS)[number]): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .filter((value) => value.length > 0);
}

export function parseExploreSearch(params: URLSearchParams): ExploreUrlState {
  const parsedSearch = SearchSchema.safeParse(params.get("q") ?? "");
  const parsedFilters = FindingFiltersSchema.safeParse(
    Object.fromEntries(
      FILTER_PARAMS.flatMap((key) => {
        const values = splitFilterValues(params, key);
        return values.length > 0 ? [[key, values] as const] : [];
      }),
    ),
  );
  const parsedSort = FindingSortSchema.safeParse({
    field: params.get("sort") ?? DEFAULT_EXPLORE_URL_STATE.sort.field,
    direction: params.get("dir") ?? DEFAULT_EXPLORE_URL_STATE.sort.direction,
  });
  const parsedMode = AnalysisModeSchema.safeParse(
    params.get("mode") ?? DEFAULT_EXPLORE_URL_STATE.analysisMode,
  );
  const parsedPreset = TimeRangePresetSchema.safeParse(
    params.get("range") ?? DEFAULT_EXPLORE_URL_STATE.timeRange.preset,
  );
  const parsedTimeRange = TimeRangeInputSchema.safeParse({
    preset: parsedPreset.success ? parsedPreset.data : "live",
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  const parsedCursor = FindingCursorSchema.safeParse(params.get("after"));

  return {
    search: parsedSearch.success ? parsedSearch.data : DEFAULT_EXPLORE_URL_STATE.search,
    filters: parsedFilters.success ? parsedFilters.data : {},
    sort: parsedSort.success ? parsedSort.data : DEFAULT_EXPLORE_URL_STATE.sort,
    analysisMode: parsedMode.success ? parsedMode.data : DEFAULT_EXPLORE_URL_STATE.analysisMode,
    // Invalid/missing/reversed custom bounds recover to Live instead of sending
    // a partial custom range to GraphQL.
    timeRange: parsedTimeRange.success ? parsedTimeRange.data : { preset: "live" },
    after: parsedCursor.success ? (parsedCursor.data as FindingCursor) : null,
  };
}

export function exploreStateToSearch(state: ExploreUrlState): string {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  for (const key of FILTER_PARAMS) {
    const values = state.filters[key];
    if (values && values.length > 0) params.set(key, values.join(","));
  }
  params.set("sort", state.sort.field);
  params.set("dir", state.sort.direction);
  params.set("mode", state.analysisMode);
  params.set("range", state.timeRange.preset);
  if (
    state.timeRange.preset === "custom" &&
    state.timeRange.from !== undefined &&
    state.timeRange.to !== undefined
  ) {
    params.set("from", state.timeRange.from);
    params.set("to", state.timeRange.to);
  }
  if (state.after) params.set("after", state.after);
  return params.toString();
}
