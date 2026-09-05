import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type DataTableRow, OverviewCard } from "./OverviewCard";
import type { PublishedTrendBucket } from "./overview.types";
import { useReducedMotion } from "./overview-charts";

type Props = {
  buckets: PublishedTrendBucket[];
  className?: string;
};

export function PublishedTrendCard({ buckets, className }: Props) {
  const reduceMotion = useReducedMotion();
  const rows: DataTableRow[] = buckets.map((bucket) => ({
    key: bucket.month,
    label: bucket.month,
    value: bucket.count,
  }));

  return (
    <OverviewCard
      title="Published trend"
      description="Monthly source-record counts by CVE published date."
      summary={`${rows.length.toLocaleString()} monthly ${
        rows.length === 1 ? "bucket" : "buckets"
      } returned for the active range. Exact values are available in the data table.`}
      rows={rows}
      labelHeading="Month"
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            minTickGap={24}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={48}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            isAnimationActive={!reduceMotion}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--popover-foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Published"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-1)" }}
            isAnimationActive={!reduceMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </OverviewCard>
  );
}
