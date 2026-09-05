import {
  ANALYSIS_MODES,
  type AnalysisMode,
  AnalysisModeSchema,
  type FindingFilters,
} from "@repo/shared";
import { Button } from "@repo/ui/components/ui/button";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

import { ANALYSIS_MODE_LABELS, analysisModeExclusionLabel } from "./compare-view";

const SELECT_CONTENT_CLASS =
  "w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)";
const SELECT_ITEM_CLASS =
  "min-h-9 py-2 pr-3 pl-8 [&>span:first-child]:right-auto [&>span:first-child]:left-2";

type Props = {
  left: AnalysisMode;
  right: AnalysisMode;
  filters: FindingFilters;
  isSameMode: boolean;
  isSubmitting: boolean;
  onLeftChange: (mode: AnalysisMode) => void;
  onRightChange: (mode: AnalysisMode) => void;
  onCompare: () => void;
};

const FILTER_LABELS: Readonly<Partial<Record<keyof FindingFilters, string>>> = {
  severity: "Severity",
  status: "Status",
  group: "Group",
  repo: "Repository",
  packageType: "Package type",
};

export function CompareForm({
  left,
  right,
  filters,
  isSameMode,
  isSubmitting,
  onLeftChange,
  onRightChange,
  onCompare,
}: Props) {
  const activeFilters = (
    Object.entries(filters) as Array<[keyof FindingFilters, string[]]>
  ).flatMap(([field, values]) => values.map((value) => ({ field, value })));

  return (
    <form
      className="mt-6 space-y-4 border-y bg-muted/35 px-3 py-4 sm:px-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSameMode) onCompare();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="compare-left-mode" className="text-xs text-muted-foreground">
            Left side
          </Label>
          <Select
            value={left}
            onValueChange={(value) => {
              const parsed = AnalysisModeSchema.safeParse(value);
              if (parsed.success) onLeftChange(parsed.data);
            }}
          >
            <SelectTrigger id="compare-left-mode" className="mt-1 w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className={SELECT_CONTENT_CLASS}>
              {ANALYSIS_MODES.map((mode) => (
                <SelectItem key={mode} className={SELECT_ITEM_CLASS} value={mode}>
                  {ANALYSIS_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{analysisModeExclusionLabel(left)}</p>
        </div>

        <div>
          <Label htmlFor="compare-right-mode" className="text-xs text-muted-foreground">
            Right side
          </Label>
          <Select
            value={right}
            onValueChange={(value) => {
              const parsed = AnalysisModeSchema.safeParse(value);
              if (parsed.success) onRightChange(parsed.data);
            }}
          >
            <SelectTrigger id="compare-right-mode" className="mt-1 w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className={SELECT_CONTENT_CLASS}>
              {ANALYSIS_MODES.map((mode) => (
                <SelectItem key={mode} className={SELECT_ITEM_CLASS} value={mode}>
                  {ANALYSIS_MODE_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{analysisModeExclusionLabel(right)}</p>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Active Explore filters stay applied:{" "}
          {activeFilters
            .map(({ field, value }) => `${FILTER_LABELS[field] ?? String(field)} ${value}`)
            .join(", ")}
          .
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSameMode || isSubmitting}>
          Compare
        </Button>
        {isSameMode && (
          <p className="text-sm text-destructive" role="status">
            Choose two different analysis modes.
          </p>
        )}
      </div>
    </form>
  );
}
