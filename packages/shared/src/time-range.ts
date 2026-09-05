/**
 * Time-range presets applied to the CVE `publishedAt` column (ADR-0001).
 * `live` means no window plus real-time application of DatasetEvents.
 */
import { z } from "zod/mini";

export const TIME_RANGE_PRESETS = ["live", "24h", "7d", "30d", "1y", "5y", "custom"] as const;

const ISO_DATE_TIME = z.iso.datetime({ offset: true });

type RollingPreset = Exclude<TimeRangePreset, "live" | "custom">;

interface UtcShift {
  readonly hours?: number;
  readonly days?: number;
  readonly years?: number;
}

const ROLLING_WINDOWS: Readonly<Record<RollingPreset, UtcShift>> = {
  "24h": { hours: 24 },
  "7d": { days: 7 },
  "30d": { days: 30 },
  "1y": { years: 1 },
  "5y": { years: 5 },
};

// [schemas]

export const TimeRangePresetSchema = z.enum(TIME_RANGE_PRESETS);

/**
 * Serializable time-range selection (URL state, GraphQL `timeRange` argument).
 * `from` and `to` are ISO 8601 strings and are required exactly when `preset`
 * is `custom`.
 */
export const TimeRangeInputSchema = z
  .object({
    preset: TimeRangePresetSchema,
    from: z.optional(ISO_DATE_TIME),
    to: z.optional(ISO_DATE_TIME),
  })
  .check(
    z.refine(
      (value) =>
        value.preset === "custom"
          ? value.from !== undefined && value.to !== undefined
          : value.from === undefined && value.to === undefined,
      "from and to are required for the custom preset and not allowed otherwise",
    ),
    z.refine(
      (value) =>
        value.from === undefined ||
        value.to === undefined ||
        Date.parse(value.from) <= Date.parse(value.to),
      "from must not be after to",
    ),
  );

// [types]

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];
export type TimeRangeInput = z.infer<typeof TimeRangeInputSchema>;

export interface TimeRangePresetOption {
  readonly preset: TimeRangePreset;
  readonly label: string;
}

export interface ResolvedTimeRange {
  readonly from: Date | null;
  readonly to: Date | null;
}

export const TIME_RANGE_PRESET_LABELS: Readonly<Record<TimeRangePreset, string>> = {
  live: "Live",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "1y": "Last year",
  "5y": "Last 5 years",
  custom: "Custom",
};

/** Presets in UI order with their labels. */
export const TIME_RANGE_PRESET_OPTIONS: readonly TimeRangePresetOption[] = TIME_RANGE_PRESETS.map(
  (preset) => ({ preset, label: TIME_RANGE_PRESET_LABELS[preset] }),
);

export function parseTimeRangeInput(value: unknown): TimeRangeInput {
  return TimeRangeInputSchema.parse(value);
}

/** Returns a new Date shifted back by calendar units in UTC; never mutates `date`. */
function shiftBackUtc(date: Date, { hours = 0, days = 0, years = 0 }: UtcShift): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear() - years,
      date.getUTCMonth(),
      date.getUTCDate() - days,
      date.getUTCHours() - hours,
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/**
 * Window for a non-custom preset: `live` has no bounds; rolling presets end at
 * `now` and start the preset's calendar distance earlier (UTC arithmetic).
 */
export function toInterval(
  preset: Exclude<TimeRangePreset, "custom">,
  now: Date,
): ResolvedTimeRange {
  if (preset === "live") return { from: null, to: null };
  return { from: shiftBackUtc(now, ROLLING_WINDOWS[preset]), to: new Date(now.getTime()) };
}

/** Resolves any validated selection to absolute bounds; `custom` uses its own inputs. */
export function resolveTimeRange(input: TimeRangeInput, now: Date): ResolvedTimeRange {
  if (input.preset === "custom") {
    return {
      from: input.from === undefined ? null : new Date(input.from),
      to: input.to === undefined ? null : new Date(input.to),
    };
  }
  return toInterval(input.preset, now);
}
