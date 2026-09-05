import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { CompareForm } from "../features/compare/CompareForm";
import { CompareResults } from "../features/compare/CompareResults";
import { compareStateToSearch, parseCompareSearch } from "../features/compare/compare-url-state";
import { useCompareAnalysis } from "../features/compare/use-compare-analysis";

export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseCompareSearch(params), [params]);
  const isSameMode = state.left === state.right;
  const query = useCompareAnalysis(
    state.filters,
    state.timeRange,
    state.left,
    state.right,
    state.compared && !isSameMode,
  );
  const isComplete = query.dataState === "complete";

  const updateState = (next: typeof state, replace = false) => {
    setParams(compareStateToSearch(next), { replace });
  };

  return (
    <section aria-labelledby="compare-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Analysis mode comparison
      </p>
      <h1 id="compare-heading" className="mt-1 text-3xl font-semibold tracking-tight">
        Compare
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Compare two analysis modes over the same filters and published time range. Analysis excludes
        exact <code>invalid - norisk</code>; AI Analysis excludes exact{" "}
        <code>ai-invalid-norisk</code>. Missing values stay included.
      </p>

      <CompareForm
        left={state.left}
        right={state.right}
        filters={state.filters}
        isSameMode={isSameMode}
        isSubmitting={query.loading && state.compared}
        onLeftChange={(left) => updateState({ ...state, left, compared: false })}
        onRightChange={(right) => updateState({ ...state, right, compared: false })}
        onCompare={() => updateState({ ...state, compared: true })}
      />

      <CompareResults
        state={state}
        data={isComplete ? query.data : undefined}
        isComplete={isComplete}
        isLoading={query.loading}
        hasError={Boolean(query.error)}
        onRetry={() => void query.refetch()}
      />
    </section>
  );
}
