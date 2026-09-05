import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DataTableRow } from "./OverviewCard";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => true);
}

type BucketBarChartProps = {
  rows: DataTableRow[];
  color?: string;
  onSelect?: (row: DataTableRow) => void;
};

function shortenLabel(value: string): string {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

export function BucketBarChart({ rows, color = "var(--chart-1)", onSelect }: BucketBarChartProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={112}
          tickFormatter={shortenLabel}
          tick={{ fill: "var(--foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          isAnimationActive={!reduceMotion}
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
          }}
        />
        <Bar
          dataKey="value"
          name="Count"
          fill={color}
          radius={[0, 4, 4, 0]}
          isAnimationActive={!reduceMotion}
          cursor={onSelect ? "pointer" : undefined}
          onClick={
            onSelect
              ? (entry) => {
                  const row = (entry as unknown as { payload?: DataTableRow }).payload;
                  if (row) onSelect(row);
                }
              : undefined
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
