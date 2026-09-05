import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FacetValue, SeverityCount } from "../../graphql/generated";

type Props = {
  bySeverity: SeverityCount[];
  total: number;
  analysisCount: number;
  aiAnalysisCount: number;
  topGroups: FacetValue[];
  topRepos: FacetValue[];
  onSeverityClick: (severity: string) => void;
};

export function OverviewCharts({
  bySeverity,
  total,
  analysisCount,
  aiAnalysisCount,
  topGroups,
  topRepos,
  onSeverityClick,
}: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <figure aria-labelledby="severity-chart-title">
        <figcaption id="severity-chart-title" className="mb-2 font-medium">
          By severity (total {total.toLocaleString()})
        </figcaption>
        <div className="h-64" role="img" aria-label="Severity distribution bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySeverity}>
              <XAxis dataKey="severity" />
              <YAxis allowDecimals={false} />
              <Tooltip isAnimationActive={!reduceMotion} />
              <Bar
                dataKey="count"
                fill="var(--color-primary, #334155)"
                isAnimationActive={!reduceMotion}
                cursor="pointer"
                onClick={(entry) => {
                  const severity = (entry as { severity?: string }).severity;
                  if (severity) onSeverityClick(severity);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {bySeverity.map((row) => (
            <li key={row.severity}>
              <button
                type="button"
                className="hover:underline"
                onClick={() => onSeverityClick(row.severity)}
              >
                {row.severity}: {row.count.toLocaleString()}
              </button>
            </li>
          ))}
        </ul>
      </figure>

      <figure aria-labelledby="analysis-chart-title">
        <figcaption id="analysis-chart-title" className="mb-2 font-medium">
          Analysis modes
        </figcaption>
        <ul className="space-y-2 text-sm">
          <li>All records: {total.toLocaleString()}</li>
          <li>
            Analysis (excludes exact <code>invalid - norisk</code>):{" "}
            {analysisCount.toLocaleString()}
          </li>
          <li>
            AI Analysis (excludes exact <code>ai-invalid-norisk</code>):{" "}
            {aiAnalysisCount.toLocaleString()}
          </li>
        </ul>
      </figure>

      <figure aria-labelledby="groups-title">
        <figcaption id="groups-title" className="mb-2 font-medium">
          Largest groups
        </figcaption>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {topGroups.map((g) => (
            <li key={g.value}>
              {g.value}: {g.count.toLocaleString()}
            </li>
          ))}
        </ol>
      </figure>

      <figure aria-labelledby="repos-title">
        <figcaption id="repos-title" className="mb-2 font-medium">
          Largest repositories
        </figcaption>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {topRepos.map((r) => (
            <li key={r.value}>
              {r.value}: {r.count.toLocaleString()}
            </li>
          ))}
        </ol>
      </figure>
    </div>
  );
}
