import { type AnalysisMode, excludedKaiStatus } from "@repo/shared";

export const ANALYSIS_MODE_LABELS: Readonly<Record<AnalysisMode, string>> = {
  all: "All findings",
  analysis: "Analysis",
  aiAnalysis: "AI Analysis",
};

export const SEVERITY_COMPARE_ORDER = ["critical", "high", "medium", "low", "unknown"] as const;

export interface FacetCount {
  value: string;
  count: number;
}

export interface CompareMetricRow {
  key: string;
  label: string;
  left: number;
  right: number;
  delta: number;
}

export function analysisModeExclusionLabel(mode: AnalysisMode): string {
  const excluded = excludedKaiStatus(mode);
  if (excluded === null) return "No kaiStatus exclusion";
  return `Excludes exact ${excluded}`;
}

export function mergeFacetRows(
  left: readonly FacetCount[],
  right: readonly FacetCount[],
  preferredOrder: readonly string[] = [],
): CompareMetricRow[] {
  const leftMap = new Map(left.map((row) => [row.value, row.count]));
  const rightMap = new Map(right.map((row) => [row.value, row.count]));
  const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const preferred = preferredOrder.filter((key) => keys.has(key));
  const remaining = [...keys]
    .filter((key) => !preferred.includes(key))
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey));

  return [...preferred, ...remaining].map((key) => {
    const leftCount = leftMap.get(key) ?? 0;
    const rightCount = rightMap.get(key) ?? 0;
    return {
      key,
      label: key.length > 0 ? key : "(blank)",
      left: leftCount,
      right: rightCount,
      delta: rightCount - leftCount,
    };
  });
}

export function formatSignedCount(value: number): string {
  if (value === 0) return "0";
  const formatted = Math.abs(value).toLocaleString();
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}
