import {
  TIME_RANGE_PRESET_OPTIONS,
  type TimeRangeInput,
  type TimeRangePreset,
  TimeRangePresetSchema,
} from "@repo/shared";
import { TimeRange } from "@repo/ui/components/time-range/time-range";
import type { TimeRangeValue } from "@repo/ui/components/time-range/time-range.types";
import { useMemo, useState } from "react";

import type { LiveConnectionState } from "../../state/dashboard-store";

const COMPACT_LABELS: Readonly<Record<TimeRangePreset, string>> = {
  live: "Live",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "1y": "1y",
  "5y": "5y",
  custom: "Custom",
};

const LIVE_CONNECTED_CLASS =
  "overflow-visible data-[state=on]:border-emerald-600/40 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800 data-[state=on]:hover:bg-emerald-50 data-[state=on]:hover:text-emerald-800";

type Props = {
  value: TimeRangeInput;
  onValueChange: (value: TimeRangeInput) => void;
  /** When provided, the Live preset shows connection emphasis while selected and open. */
  connection?: LiveConnectionState;
};

function LiveConnectedDot() {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
    </span>
  );
}

function toUiValue(value: TimeRangeInput): TimeRangeValue {
  if (value.preset !== "custom" || value.from === undefined || value.to === undefined) {
    return { preset: value.preset };
  }
  return {
    preset: value.preset,
    from: new Date(value.from),
    to: new Date(value.to),
  };
}

function toInclusiveIsoRange(from: Date, to: Date): TimeRangeInput {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { preset: "custom", from: start.toISOString(), to: end.toISOString() };
}

export function TimeRangeFilter({ value, onValueChange, connection }: Props) {
  const [draft, setDraft] = useState<TimeRangeValue | null>(null);
  const pickerValue = draft ?? toUiValue(value);
  const liveConnected = value.preset === "live" && connection === "open";

  const presets = useMemo(
    () =>
      TIME_RANGE_PRESET_OPTIONS.map(({ preset, label }) => {
        const compactLabel = COMPACT_LABELS[preset];
        const accessibleName = preset === "custom" ? "Custom relative time" : label;
        const isLive = preset === "live";
        return {
          value: preset,
          label: compactLabel,
          ariaLabel: isLive
            ? liveConnected
              ? "Live, connected"
              : compactLabel
            : compactLabel === accessibleName
              ? undefined
              : accessibleName,
          className: isLive && liveConnected ? LIVE_CONNECTED_CLASS : undefined,
          leading: isLive && liveConnected ? <LiveConnectedDot /> : undefined,
        };
      }),
    [liveConnected],
  );

  const handleValueChange = (next: TimeRangeValue) => {
    const preset = TimeRangePresetSchema.safeParse(next.preset);
    if (!preset.success) return;

    if (preset.data === "custom") {
      if (!next.from || !next.to) {
        setDraft(next);
        return;
      }
      setDraft(null);
      onValueChange(toInclusiveIsoRange(next.from, next.to));
      return;
    }

    setDraft(null);
    onValueChange({ preset: preset.data });
  };

  return (
    <TimeRange.Root
      value={pickerValue}
      onValueChange={handleValueChange}
      label="Published time range"
      className="items-start"
    >
      <TimeRange.Presets
        presets={presets}
        className="w-fit max-w-full"
        aria-label="Published time range presets"
      />
      <TimeRange.Custom numberOfMonths={1} disabled={{ after: new Date() }} />
    </TimeRange.Root>
  );
}
