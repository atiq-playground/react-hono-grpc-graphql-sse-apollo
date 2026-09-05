import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Link } from "react-router";

import { DEFAULT_EXPLORE_URL_STATE, exploreStateToSearch } from "../../app/url-state";
import type { CompareAnalysisQuery } from "../../graphql/__generated__/graphql";
import type { CompareUrlState } from "./compare-url-state";
import {
  ANALYSIS_MODE_LABELS,
  analysisModeExclusionLabel,
  type CompareMetricRow,
  formatSignedCount,
  mergeFacetRows,
  SEVERITY_COMPARE_ORDER,
} from "./compare-view";

type Props = {
  state: CompareUrlState;
  data: CompareAnalysisQuery | undefined;
  isComplete: boolean;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
};

function exploreHref(state: CompareUrlState, side: "left" | "right"): string {
  return `/explore?${exploreStateToSearch({
    ...DEFAULT_EXPLORE_URL_STATE,
    search: state.search,
    filters: state.filters,
    timeRange: state.timeRange,
    analysisMode: state[side],
  })}`;
}

function MetricTable({
  captionId,
  caption,
  leftLabel,
  rightLabel,
  leftHref,
  rightHref,
  rows,
}: {
  captionId: string;
  caption: string;
  leftLabel: string;
  rightLabel: string;
  leftHref: string;
  rightHref: string;
  rows: readonly CompareMetricRow[];
}) {
  return (
    <Table>
      <caption id={captionId} className="visually-hidden">
        {caption}
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead className="text-right">
            <Link className="underline-offset-2 hover:underline" to={leftHref}>
              {leftLabel}
            </Link>
          </TableHead>
          <TableHead className="text-right">
            <Link className="underline-offset-2 hover:underline" to={rightHref}>
              {rightLabel}
            </Link>
          </TableHead>
          <TableHead className="text-right">Difference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{row.left.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">{row.right.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatSignedCount(row.delta)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CompareResults({ state, data, isComplete, isLoading, hasError, onRetry }: Props) {
  const leftLabel = ANALYSIS_MODE_LABELS[state.left];
  const rightLabel = ANALYSIS_MODE_LABELS[state.right];
  const leftHref = exploreHref(state, "left");
  const rightHref = exploreHref(state, "right");

  if (!state.compared) {
    return (
      <Card className="mt-6 border-dashed shadow-none" role="status">
        <CardContent className="py-8">
          <h2 className="font-semibold">Choose two analysis modes, then Compare</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defaults are Analysis versus AI Analysis. The comparison uses exact{" "}
            <code>kaiStatus</code> exclusions over the same filters and time range.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !isComplete) {
    return (
      <div className="mt-6 space-y-3" role="status" aria-live="polite" aria-busy="true">
        <span className="visually-hidden">Loading analysis comparison…</span>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (hasError && !isComplete) {
    return (
      <Card className="mt-6 border-destructive/40 shadow-none" role="alert">
        <CardContent className="flex flex-col items-start gap-3">
          <div>
            <h2 className="font-semibold">Unable to load the comparison</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The bounded GraphQL compare request did not complete.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isComplete || !data) return null;

  const totals: CompareMetricRow[] = [
    {
      key: "total",
      label: "Current findings",
      left: data.left.totalCount,
      right: data.right.totalCount,
      delta: data.right.totalCount - data.left.totalCount,
    },
  ];
  const severityRows = mergeFacetRows(
    data.leftFacets.severity,
    data.rightFacets.severity,
    SEVERITY_COMPARE_ORDER,
  );
  const kaiStatusRows = mergeFacetRows(data.leftFacets.kaiStatus, data.rightFacets.kaiStatus);
  const isEmpty = data.left.totalCount === 0 && data.right.totalCount === 0;

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">
        {leftLabel}: {analysisModeExclusionLabel(state.left)}. {rightLabel}:{" "}
        {analysisModeExclusionLabel(state.right)}. Difference is right minus left.
      </p>

      {isEmpty && (
        <Card className="border-dashed shadow-none" role="status">
          <CardContent className="py-6">
            <h2 className="font-semibold">No matching findings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust the time range or Explore filters and compare again.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="border-b bg-muted/35 px-4 py-3">
          <CardTitle>
            <h2 className="text-sm font-semibold uppercase tracking-wide">Finding totals</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <MetricTable
            captionId="compare-totals-caption"
            caption={`Finding totals for ${leftLabel} versus ${rightLabel}`}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
            leftHref={leftHref}
            rightHref={rightHref}
            rows={totals}
          />
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="border-b bg-muted/35 px-4 py-3">
          <CardTitle>
            <h2 className="text-sm font-semibold uppercase tracking-wide">Severity</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {severityRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground" role="status">
              No data
            </p>
          ) : (
            <MetricTable
              captionId="compare-severity-caption"
              caption={`Severity counts for ${leftLabel} versus ${rightLabel}`}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              leftHref={leftHref}
              rightHref={rightHref}
              rows={severityRows}
            />
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="border-b bg-muted/35 px-4 py-3">
          <CardTitle>
            <h2 className="text-sm font-semibold uppercase tracking-wide">KAI status</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {kaiStatusRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground" role="status">
              No data
            </p>
          ) : (
            <MetricTable
              captionId="compare-kai-caption"
              caption={`KAI status counts for ${leftLabel} versus ${rightLabel}`}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              leftHref={leftHref}
              rightHref={rightHref}
              rows={kaiStatusRows}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
