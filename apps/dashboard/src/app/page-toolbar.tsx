import { type AnalysisMode, AnalysisModeSchema, type TimeRangeInput } from "@repo/shared";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useStore } from "zustand";

import {
  type CompareUrlState,
  compareStateToSearch,
  parseCompareSearch,
} from "../features/compare/compare-url-state";
import { ExportButton } from "../features/explore/ExportButton";
import { SearchSuggestionsField } from "../features/explore/SearchSuggestionsField";
import { TimeRangeFilter } from "../features/time-range/TimeRangeFilter";
import { useDashboardStore } from "./dashboard-context";
import {
  DEFAULT_EXPLORE_URL_STATE,
  type ExploreUrlState,
  exploreStateToSearch,
  parseExploreSearch,
} from "./url-state";

const SEARCH_DEBOUNCE_MS = 300;

const ANALYSIS_MODE_CONTENT_CLASS =
  "w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)";

const ANALYSIS_MODE_ITEM_CLASS =
  "min-h-9 py-2 pr-3 pl-8 [&>span:first-child]:right-auto [&>span:first-child]:left-2";

function isComparePath(pathname: string): boolean {
  return pathname === "/compare" || pathname.startsWith("/compare/");
}

function toExportState(
  explore: ExploreUrlState,
  compare: CompareUrlState,
  useCompare: boolean,
): ExploreUrlState {
  if (!useCompare) return explore;
  return {
    ...DEFAULT_EXPLORE_URL_STATE,
    search: compare.search,
    filters: compare.filters,
    timeRange: compare.timeRange,
    analysisMode: "all",
  };
}

/**
 * Persistent shell toolbar: time range → search → analysis mode → export.
 * Wired to URL-backed exploration state. On Compare, analysis mode is disabled
 * (left/right selectors own mode); search stays URL-synced but the compare
 * GraphQL operation does not filter by search yet.
 */
export function PageToolbar() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const store = useDashboardStore();
  const connection = useStore(store, (value) => value.connection);
  const onCompare = isComparePath(pathname);
  const analysisModeHintId = useId();

  const exploreState = useMemo(() => parseExploreSearch(params), [params]);
  const compareState = useMemo(() => parseCompareSearch(params), [params]);

  const search = onCompare ? compareState.search : exploreState.search;
  const timeRange = onCompare ? compareState.timeRange : exploreState.timeRange;
  const analysisMode = exploreState.analysisMode;
  const exportState = toExportState(exploreState, compareState, onCompare);

  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const commitSearch = useCallback(
    (nextSearch: string) => {
      if (onCompare) {
        setParams(compareStateToSearch({ ...compareState, search: nextSearch, compared: false }), {
          replace: true,
        });
        return;
      }
      setParams(exploreStateToSearch({ ...exploreState, search: nextSearch, after: null }), {
        replace: true,
      });
    },
    [compareState, exploreState, onCompare, setParams],
  );

  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => commitSearch(searchDraft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [commitSearch, searchDraft, search]);

  const handleTimeRangeChange = (next: TimeRangeInput) => {
    if (onCompare) {
      setParams(compareStateToSearch({ ...compareState, timeRange: next, compared: false }));
      return;
    }
    setParams(exploreStateToSearch({ ...exploreState, timeRange: next, after: null }));
  };

  const handleAnalysisModeChange = (mode: AnalysisMode) => {
    if (onCompare) return;
    setParams(exploreStateToSearch({ ...exploreState, analysisMode: mode, after: null }));
  };

  const analysisModeHint = onCompare ? "Analysis mode is chosen per side on Compare" : undefined;

  return (
    <div
      className="mb-4 flex flex-wrap items-end gap-3 border-b border-border/70 pb-4"
      role="toolbar"
      aria-label="Exploration controls"
    >
      <TimeRangeFilter
        value={timeRange}
        onValueChange={handleTimeRangeChange}
        connection={connection}
      />

      <SearchSuggestionsField
        id="page-toolbar-search"
        value={searchDraft}
        onValueChange={setSearchDraft}
        onCommit={commitSearch}
      />

      <div className="w-full min-w-36 max-w-44 space-y-1 sm:w-44">
        <Label htmlFor="page-toolbar-analysis-mode" className="text-xs text-muted-foreground">
          Analysis mode
        </Label>
        <Select
          value={analysisMode}
          disabled={onCompare}
          onValueChange={(value) => {
            const parsed = AnalysisModeSchema.safeParse(value);
            if (parsed.success) handleAnalysisModeChange(parsed.data);
          }}
        >
          <SelectTrigger
            id="page-toolbar-analysis-mode"
            className="w-full"
            aria-describedby={onCompare ? analysisModeHintId : undefined}
            title={analysisModeHint}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className={ANALYSIS_MODE_CONTENT_CLASS}>
            <SelectItem className={ANALYSIS_MODE_ITEM_CLASS} value="all">
              All findings
            </SelectItem>
            <SelectItem className={ANALYSIS_MODE_ITEM_CLASS} value="analysis">
              Analysis
            </SelectItem>
            <SelectItem className={ANALYSIS_MODE_ITEM_CLASS} value="aiAnalysis">
              AI Analysis
            </SelectItem>
          </SelectContent>
        </Select>
        {onCompare && (
          <p id={analysisModeHintId} className="text-xs text-muted-foreground">
            {analysisModeHint}
          </p>
        )}
      </div>

      <div className="ml-auto space-y-1">
        <span
          className="block text-xs leading-none text-transparent select-none"
          aria-hidden="true"
        >
          Export
        </span>
        <ExportButton state={exportState} />
      </div>
    </div>
  );
}
