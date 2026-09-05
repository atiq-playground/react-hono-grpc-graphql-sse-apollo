import type { FindingFilters } from "@repo/shared";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";

import type { ExploreUrlState } from "../../app/url-state";

type Props = {
  state: ExploreUrlState;
  pendingUpdates: number;
  onStateChange: (state: ExploreUrlState) => void;
  onRefresh: () => Promise<void>;
};

const FILTER_LABELS: Readonly<Partial<Record<keyof FindingFilters, string>>> = {
  severity: "Severity",
  status: "Status",
  group: "Group",
  repo: "Repository",
  packageType: "Package type",
};

/** Route-local overview chrome: active filter chips and pending-update refresh. */
export function OverviewToolbar({ state, pendingUpdates, onStateChange, onRefresh }: Props) {
  const activeFilters = (
    Object.entries(state.filters) as Array<[keyof FindingFilters, string[]]>
  ).flatMap(([field, values]) => values.map((value) => ({ field, value })));

  const removeFilter = (field: keyof FindingFilters, value: string) => {
    const remaining = state.filters[field]?.filter((candidate) => candidate !== value) ?? [];
    const nextFilters: FindingFilters = {
      ...state.filters,
      [field]: remaining.length > 0 ? remaining : undefined,
    };
    onStateChange({ ...state, filters: nextFilters, after: null });
  };

  const showRefresh = pendingUpdates > 0 && state.timeRange.preset !== "live";
  if (activeFilters.length === 0 && !showRefresh) return null;

  return (
    <div className="mt-6 border-y bg-muted/35 px-3 py-4 sm:px-4">
      {showRefresh && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()}>
            {pendingUpdates.toLocaleString()} updates — Refresh
          </Button>
        </div>
      )}

      {activeFilters.length > 0 && (
        <fieldset className={`${showRefresh ? "mt-4" : ""} flex flex-wrap items-center gap-2`}>
          <legend className="float-left mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filtered by
          </legend>
          {activeFilters.map(({ field, value }) => (
            <Badge key={`${String(field)}:${value}`} variant="secondary" className="gap-1 pr-1">
              <span>
                {FILTER_LABELS[field] ?? String(field)}: {value}
              </span>
              <button
                type="button"
                className="rounded-sm px-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-1"
                aria-label={`Remove ${FILTER_LABELS[field] ?? String(field)} filter ${value}`}
                onClick={() => removeFilter(field, value)}
              >
                ×
              </button>
            </Badge>
          ))}
        </fieldset>
      )}
    </div>
  );
}
