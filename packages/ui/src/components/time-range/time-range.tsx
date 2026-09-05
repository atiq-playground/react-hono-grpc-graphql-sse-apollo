"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import type {
  TimeRangeContextValue,
  TimeRangeCustomProps,
  TimeRangePreset,
  TimeRangePresetsProps,
  TimeRangeRootProps,
  TimeRangeValue,
} from "./time-range.types";

const DAY_MS = 86_400_000;
const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();

const TimeRangeContext = React.createContext<TimeRangeContextValue | null>(null);

function useTimeRangeContext(): TimeRangeContextValue {
  const context = React.useContext(TimeRangeContext);
  if (!context) {
    throw new Error("TimeRange components must be rendered inside <TimeRange.Root>.");
  }
  return context;
}

function defaultFormatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function describeValue(
  value: TimeRangeValue,
  customValue: string,
  presetLabels: ReadonlyMap<string, string>,
  formatDate: (date: Date) => string,
): string {
  if (value.preset !== customValue) {
    return presetLabels.get(value.preset) ?? value.preset;
  }
  if (value.from && value.to) {
    return `custom, ${formatDate(value.from)} to ${formatDate(value.to)}`;
  }
  if (value.from) {
    return `custom, from ${formatDate(value.from)}`;
  }
  return "custom, no dates applied";
}

function countDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / DAY_MS) + 1;
}

function formatDayCount(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function TimeRangeRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  customValue = "custom",
  label = "Time range",
  formatDate = defaultFormatDate,
  className,
  children,
}: TimeRangeRootProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<TimeRangeValue>(
    () => defaultValue ?? { preset: "" },
  );
  const [presetLabels, setPresetLabels] = React.useState<ReadonlyMap<string, string>>(EMPTY_LABELS);
  const [isCustomOpen, setIsCustomOpen] = React.useState(false);
  const customTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : uncontrolledValue;

  const setValue = React.useCallback(
    (next: TimeRangeValue) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const registerPresets = React.useCallback((presets: readonly TimeRangePreset[]) => {
    setPresetLabels(
      new Map(presets.map((preset) => [preset.value, preset.ariaLabel ?? preset.label])),
    );
  }, []);

  const contextValue: TimeRangeContextValue = {
    value,
    setValue,
    customValue,
    isCustom: value.preset === customValue,
    isCustomOpen,
    setIsCustomOpen,
    customTriggerRef,
    formatDate,
    presetLabels,
    registerPresets,
  };

  const announcement = `${label}: ${describeValue(value, customValue, presetLabels, formatDate)}`;

  return (
    <TimeRangeContext.Provider value={contextValue}>
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <fieldset
          data-slot="time-range"
          className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
        >
          <legend className="visually-hidden">{label}</legend>
          {children}
          <span className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announcement}
          </span>
        </fieldset>
      </Popover>
    </TimeRangeContext.Provider>
  );
}

function TimeRangePresets({
  presets,
  size = "sm",
  variant = "outline",
  className,
  ...props
}: TimeRangePresetsProps) {
  const {
    value,
    setValue,
    customValue,
    isCustomOpen,
    setIsCustomOpen,
    customTriggerRef,
    registerPresets,
  } = useTimeRangeContext();

  React.useEffect(() => {
    registerPresets(presets);
  }, [presets, registerPresets]);

  const handleValueChange = (next: string) => {
    // Radix emits "" when the pressed item is toggled off; keep one preset selected.
    // Re-activating Custom still opens the calendar so dates can be changed.
    if (!next || next === value.preset) {
      if (value.preset === customValue) {
        setIsCustomOpen(!isCustomOpen);
      }
      return;
    }
    const keepsDates = next === customValue;
    setValue({
      preset: next,
      from: keepsDates ? value.from : undefined,
      to: keepsDates ? value.to : undefined,
    });
    setIsCustomOpen(next === customValue);
  };

  return (
    <ToggleGroup
      data-slot="time-range-presets"
      type="single"
      value={value.preset}
      onValueChange={handleValueChange}
      size={size}
      variant={variant}
      className={className}
      {...props}
    >
      {presets.map((preset) => {
        const isCustomPreset = preset.value === customValue;
        const item = (
          <ToggleGroupItem
            ref={isCustomPreset ? customTriggerRef : undefined}
            value={preset.value}
            disabled={preset.disabled}
            aria-label={preset.ariaLabel ?? preset.label}
            aria-haspopup={isCustomPreset ? "dialog" : undefined}
            aria-expanded={isCustomPreset ? isCustomOpen : undefined}
            className={cn("min-w-fit flex-none whitespace-nowrap px-2.5", preset.className)}
          >
            {preset.leading}
            {preset.label}
          </ToggleGroupItem>
        );

        if (!isCustomPreset) {
          return <React.Fragment key={preset.value}>{item}</React.Fragment>;
        }

        return (
          <PopoverAnchor key={preset.value} asChild>
            {item}
          </PopoverAnchor>
        );
      })}
    </ToggleGroup>
  );
}

function TimeRangeCustom({
  placeholder = "No dates selected",
  applyLabel = "Apply",
  clearLabel = "Clear",
  numberOfMonths = 2,
  disabled,
  className,
}: TimeRangeCustomProps) {
  const {
    value,
    setValue,
    customValue,
    isCustom,
    isCustomOpen,
    setIsCustomOpen,
    customTriggerRef,
    formatDate,
  } = useTimeRangeContext();
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    if (!isCustomOpen) return;
    setDraft(value.from ? { from: value.from, to: value.to } : undefined);
  }, [isCustomOpen, value.from, value.to]);

  const handleApply = () => {
    if (!draft?.from) return;
    setValue({ preset: customValue, from: draft.from, to: draft.to ?? draft.from });
    setIsCustomOpen(false);
  };

  const handleClear = () => {
    setDraft(undefined);
    setValue({ preset: customValue });
  };

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    customTriggerRef.current?.focus();
  };

  const draftSummary = draft?.from
    ? draft.to
      ? `${formatDate(draft.from)} to ${formatDate(draft.to)}`
      : `${formatDate(draft.from)} to ...`
    : placeholder;

  return (
    <>
      <PopoverContent
        align="end"
        className="w-auto p-0"
        aria-label="Custom relative time"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <Calendar
          mode="range"
          numberOfMonths={numberOfMonths}
          defaultMonth={draft?.from ?? value.from}
          selected={draft}
          onSelect={setDraft}
          disabled={disabled}
          autoFocus
        />
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {draftSummary}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!draft?.from && !value.from}
            >
              {clearLabel}
            </Button>
            <Button type="button" size="sm" onClick={handleApply} disabled={!draft?.from}>
              {applyLabel}
            </Button>
          </div>
        </div>
      </PopoverContent>
      {isCustom && value.from && value.to ? (
        <span data-slot="time-range-custom" className={cn("flex items-center gap-2", className)}>
          <Badge variant="secondary" data-slot="time-range-days">
            {formatDayCount(countDays(value.from, value.to))}
          </Badge>
        </span>
      ) : null}
    </>
  );
}

const TimeRange = {
  Root: TimeRangeRoot,
  Presets: TimeRangePresets,
  Custom: TimeRangeCustom,
};

export { TimeRange, TimeRangeCustom, TimeRangePresets, TimeRangeRoot, useTimeRangeContext };
