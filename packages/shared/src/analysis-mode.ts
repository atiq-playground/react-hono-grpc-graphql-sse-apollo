/**
 * Analysis and AI Analysis semantics (docs/CONTEXT.md). Exclusions use exact
 * `kaiStatus` string equality: no trimming, normalizing, or fuzzy matching.
 * Records without `kaiStatus` remain included in every mode.
 */
import { z } from "zod/mini";

export const ANALYSIS_MODES = ["all", "analysis", "aiAnalysis"] as const;
export const ANALYSIS_EXCLUDED_KAI_STATUS = "invalid - norisk" as const;
export const AI_ANALYSIS_EXCLUDED_KAI_STATUS = "ai-invalid-norisk" as const;

// [schemas]

export const AnalysisModeSchema = z.enum(ANALYSIS_MODES);

// [types]

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const ANALYSIS_MODE_EXCLUDED_KAI_STATUS: Readonly<
  Record<Exclude<AnalysisMode, "all">, string>
> = {
  analysis: ANALYSIS_EXCLUDED_KAI_STATUS,
  aiAnalysis: AI_ANALYSIS_EXCLUDED_KAI_STATUS,
};

/** The exact `kaiStatus` value a mode excludes, or `null` when nothing is excluded. */
export function excludedKaiStatus(mode: AnalysisMode): string | null {
  return mode === "all" ? null : ANALYSIS_MODE_EXCLUDED_KAI_STATUS[mode];
}

/** Whether a record with this `kaiStatus` belongs to the Result Set for `mode`. */
export function matchesAnalysisMode(kaiStatus: string | null, mode: AnalysisMode): boolean {
  const excluded = excludedKaiStatus(mode);
  return excluded === null || kaiStatus === null || kaiStatus !== excluded;
}
