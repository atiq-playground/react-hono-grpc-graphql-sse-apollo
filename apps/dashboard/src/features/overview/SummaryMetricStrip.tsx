import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

import type { OverviewTotals } from "./overview.types";

type Props = {
  totals: OverviewTotals;
};

export function SummaryMetricStrip({ totals }: Props) {
  const metrics = [
    { label: "Source records", value: totals.total.toLocaleString() },
    { label: "Unique CVEs", value: totals.uniqueCves.toLocaleString() },
    { label: "Average CVSS", value: totals.averageCvss.toFixed(1) },
    { label: "Analysis", value: totals.analysisCount.toLocaleString() },
    { label: "AI Analysis", value: totals.aiAnalysisCount.toLocaleString() },
  ];

  return (
    <Card className="mt-6 gap-4 overflow-hidden rounded-lg py-0 shadow-none">
      <CardHeader className="border-b bg-muted/35 px-4 py-3">
        <CardTitle>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Aggregate summary</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={index === 0 ? "px-4 py-4" : "border-t px-4 py-4 sm:border-l sm:border-t-0"}
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          Analysis excludes exact <code>invalid - norisk</code>; AI Analysis excludes exact{" "}
          <code>ai-invalid-norisk</code>. Missing values remain included.
        </p>
      </CardContent>
    </Card>
  );
}
