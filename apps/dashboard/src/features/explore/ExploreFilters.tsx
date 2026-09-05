import type { FindingFilters } from "@repo/shared";
import { Combobox, type ComboboxItem } from "@repo/ui/components/combobox/combobox";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import type { FindingFacetsQuery } from "../../graphql/__generated__/graphql";

type Facets = FindingFacetsQuery["facets"];
type FilterKey = "severity" | "status" | "repo" | "group" | "packageType";
type FacetOption = Facets[FilterKey][number];

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "repo", label: "Repository" },
  { key: "group", label: "Group" },
  { key: "packageType", label: "Package type" },
];

type Props = {
  filters: FindingFilters;
  facets?: Facets;
  isLoading: boolean;
  onFiltersChange: (filters: FindingFilters) => void;
};

type FacetSelectProps = {
  filterKey: FilterKey;
  label: string;
  options: readonly FacetOption[];
  selected: readonly string[];
  onChange: (value: string | null) => void;
};

function optionValue(value: string): string {
  return `value:${value}`;
}

function FacetSelect({ filterKey, label, options, selected, onChange }: FacetSelectProps) {
  const id = `explore-filter-${filterKey}`;
  const selectedValue = selected[0];
  const allOptions = [...options];
  for (const value of selected) {
    if (!allOptions.some((option) => option.value === value)) {
      allOptions.push({ value, count: 0 });
    }
  }
  const allLabel = `All ${label.toLocaleLowerCase()}`;
  const selectedLabel =
    selectedValue === undefined
      ? allLabel
      : selected.length > 1
        ? `${selectedValue} +${selected.length - 1}`
        : selectedValue;

  const items: ComboboxItem[] = [
    { value: "all", label: allLabel, textValue: allLabel },
    ...allOptions.map((option) => {
      const display = option.value || "Unknown";
      return {
        value: optionValue(option.value),
        textValue: display,
        label: (
          <>
            <span className="min-w-0 truncate">{display}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {option.count.toLocaleString()}
            </span>
          </>
        ),
      };
    }),
  ];

  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Combobox
        id={id}
        size="sm"
        className="mt-1 w-full min-w-36"
        value={selectedValue === undefined ? "all" : optionValue(selectedValue)}
        onValueChange={(value) => onChange(value === "all" ? null : value.slice("value:".length))}
        items={items}
        placeholder={allLabel}
        triggerLabel={selectedLabel}
      />
    </div>
  );
}

export function ExploreFilters({ filters, facets, isLoading, onFiltersChange }: Props) {
  const handleChange = (key: FilterKey, value: string | null) => {
    const next = { ...filters };
    if (value === null) {
      delete next[key];
    } else {
      next[key] = [value];
    }
    onFiltersChange(next);
  };

  if (isLoading && facets === undefined) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        role="status"
        aria-label="Loading filters"
      >
        {FILTERS.map(({ key }) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <legend className="visually-hidden">Finding filters</legend>
      {FILTERS.map(({ key, label }) => (
        <FacetSelect
          key={key}
          filterKey={key}
          label={label}
          options={facets?.[key] ?? []}
          selected={filters[key] ?? []}
          onChange={(value) => handleChange(key, value)}
        />
      ))}
    </fieldset>
  );
}
