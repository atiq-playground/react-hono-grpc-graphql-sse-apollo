"use client";

import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  SELECT_TRIGGER_CLASSNAME,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  type ComboboxSearchable,
  isComboboxSearchable,
  itemTextValue,
  matchesComboboxItem,
} from "./combobox-search";

const MENU_MAX_HEIGHT_CLASS =
  "max-h-[min(calc(10*(1.25rem+var(--spacing)*3)+var(--spacing)*2),var(--radix-popover-content-available-height))]";

export type ComboboxItem = {
  value: string;
  label: React.ReactNode;
  /** Filter and fallback trigger text. Defaults to a string `label`, else `value`. */
  textValue?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  items: readonly ComboboxItem[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Overrides the trigger label when it is not a single item's `label`. */
  triggerLabel?: React.ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  /** `auto` (default) enables search when `items.length > 10`. */
  searchable?: ComboboxSearchable;
  size?: "sm" | "default";
  id?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
};

function selectedLabel(
  items: readonly ComboboxItem[],
  value: string | undefined,
  placeholder: string | undefined,
  triggerLabel: React.ReactNode | undefined,
): React.ReactNode {
  if (triggerLabel !== undefined) return triggerLabel;
  const selected = items.find((item) => item.value === value);
  if (selected) return selected.label;
  if (value) return itemTextValue({ value, label: value });
  return placeholder;
}

export function Combobox({ searchable = "auto", ...props }: ComboboxProps) {
  if (isComboboxSearchable(props.items.length, searchable)) {
    return <SearchableCombobox {...props} />;
  }
  return <PlainSelectCombobox {...props} />;
}

function PlainSelectCombobox({
  items,
  value,
  onValueChange,
  placeholder,
  triggerLabel,
  size = "default",
  id,
  disabled,
  className,
  contentClassName,
  align = "start",
}: ComboboxProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} size={size} className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedLabel(items, value, placeholder, triggerLabel)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align={align} className={contentClassName}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchableCombobox({
  items,
  value,
  onValueChange,
  placeholder,
  triggerLabel,
  searchPlaceholder = "Search...",
  emptyText = "No results",
  size = "default",
  id,
  disabled,
  className,
  contentClassName,
  align = "start",
}: ComboboxProps) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const filtered = items.filter((item) => matchesComboboxItem(item, query));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          data-slot="select-trigger"
          data-size={size}
          className={cn(SELECT_TRIGGER_CLASSNAME, className)}
        >
          <span data-slot="select-value">
            {selectedLabel(items, value, placeholder, triggerLabel)}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-(--radix-popover-trigger-width) p-0",
          contentClassName,
        )}
      >
        <Command shouldFilter={false} loop label={searchPlaceholder}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={listId}
          />
          <CommandList id={listId} className={MENU_MAX_HEIGHT_CLASS}>
            <CommandEmpty className="py-3">{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((item) => {
                const isSelected = item.value === value;
                return (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                    data-checked={isSelected}
                    className="pr-8 pl-2"
                    onPointerDown={(event) => event.preventDefault()}
                    onSelect={() => {
                      onValueChange(item.value);
                      handleOpenChange(false);
                    }}
                  >
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      {isSelected ? <CheckIcon className="size-4" /> : null}
                    </span>
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
