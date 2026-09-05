import type * as React from "react";
import type { Matcher } from "react-day-picker";

/**
 * Current selection of a `TimeRange`. `preset` is an opaque consumer-defined
 * key; `from` / `to` are only populated when the preset equals the configured
 * custom value.
 */
export type TimeRangeValue = {
  preset: string;
  from?: Date;
  to?: Date;
};

/** One selectable preset. Labels and values are owned by the consumer. */
export type TimeRangePreset = {
  value: string;
  /** Visible single-line label. */
  label: string;
  /** Accessible name when it differs from the visible label (abbreviations). */
  ariaLabel?: string;
  disabled?: boolean;
  /** Extra classes on the preset toggle (for example live-connection emphasis). */
  className?: string;
  /** Optional leading content inside the toggle, before the label. */
  leading?: React.ReactNode;
};

export type TimeRangeRootProps = {
  /** Controlled value. Pair with `onValueChange`. */
  value?: TimeRangeValue;
  /** Initial value when uncontrolled. */
  defaultValue?: TimeRangeValue;
  onValueChange?: (value: TimeRangeValue) => void;
  /** Preset value that opens the custom calendar from that segment. */
  customValue?: string;
  /** Visually hidden legend of the fieldset; also prefixes the live announcement. */
  label?: string;
  /** Formats dates for the day-count badge and live announcement. */
  formatDate?: (date: Date) => string;
  className?: string;
  children: React.ReactNode;
};

export type TimeRangePresetsProps = Omit<
  React.ComponentProps<"div">,
  "defaultValue" | "dir" | "onChange"
> & {
  presets: readonly TimeRangePreset[];
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
};

export type TimeRangeCustomProps = {
  /** Empty-state copy in the calendar footer while no draft dates are selected. */
  placeholder?: string;
  applyLabel?: string;
  clearLabel?: string;
  /** Number of calendar months rendered side by side (stacked on narrow screens). */
  numberOfMonths?: number;
  /** Days that cannot be selected, forwarded to the calendar. */
  disabled?: Matcher | Matcher[];
  className?: string;
};

export type TimeRangeContextValue = {
  value: TimeRangeValue;
  setValue: (next: TimeRangeValue) => void;
  customValue: string;
  isCustom: boolean;
  isCustomOpen: boolean;
  setIsCustomOpen: (open: boolean) => void;
  customTriggerRef: React.RefObject<HTMLButtonElement | null>;
  formatDate: (date: Date) => string;
  presetLabels: ReadonlyMap<string, string>;
  registerPresets: (presets: readonly TimeRangePreset[]) => void;
};
