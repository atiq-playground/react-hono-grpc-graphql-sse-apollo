/** Show in-menu autocomplete when the loaded option list exceeds this count. */
export const COMBOBOX_SEARCH_THRESHOLD = 10;

export type ComboboxSearchable = boolean | "auto";

export type ComboboxSearchableItem = {
  value: string;
  label: unknown;
  textValue?: string;
};

export function isComboboxSearchable(
  itemCount: number,
  searchable: ComboboxSearchable = "auto",
): boolean {
  if (searchable === true) return true;
  if (searchable === false) return false;
  return itemCount > COMBOBOX_SEARCH_THRESHOLD;
}

export function itemTextValue(item: ComboboxSearchableItem): string {
  if (item.textValue !== undefined) return item.textValue;
  if (typeof item.label === "string") return item.label;
  return item.value;
}

export function matchesComboboxItem(item: ComboboxSearchableItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    item.value.toLowerCase().includes(needle) || itemTextValue(item).toLowerCase().includes(needle)
  );
}
