import { SEARCH_FIELDS, type SearchField } from "@repo/shared";

export const SEARCH_SUGGESTION_FIELD_ENUM = {
  cve: "CVE",
  packageName: "PACKAGE_NAME",
  image: "IMAGE",
  repo: "REPO",
} as const satisfies Record<SearchField, string>;

export type SearchSuggestionFieldEnum = (typeof SEARCH_SUGGESTION_FIELD_ENUM)[SearchField];

export interface SearchSuggestionRow {
  readonly value: string;
  readonly field: SearchField;
}

export interface SearchSuggestion {
  readonly value: string;
  readonly field: SearchSuggestionFieldEnum;
}

export function isSearchField(value: string): value is SearchField {
  return (SEARCH_FIELDS as readonly string[]).includes(value);
}

/**
 * Prefer at least one match from each searchable field, then fill remaining
 * slots in field order so a single type cannot consume the entire bound.
 */
export function rankSearchSuggestions(
  rows: readonly SearchSuggestionRow[],
  limit: number,
): readonly SearchSuggestion[] {
  const boundedLimit = Math.max(0, Math.trunc(limit));
  if (boundedLimit === 0) return [];

  const buckets = new Map<SearchField, string[]>(SEARCH_FIELDS.map((field) => [field, []]));
  const seen = new Set<string>();

  for (const row of rows) {
    const bucket = buckets.get(row.field);
    if (bucket === undefined || row.value.length === 0) continue;
    const key = `${row.field}:${row.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bucket.push(row.value);
  }

  const selected: SearchSuggestion[] = [];
  const remainder = new Map<SearchField, string[]>();
  const perFieldFloor = Math.max(1, Math.floor(boundedLimit / SEARCH_FIELDS.length));

  for (const field of SEARCH_FIELDS) {
    if (selected.length >= boundedLimit) break;
    const values = buckets.get(field) ?? [];
    const takeCount = Math.min(perFieldFloor, values.length, boundedLimit - selected.length);
    const take = values.slice(0, takeCount);
    remainder.set(field, values.slice(take.length));
    for (const value of take) {
      selected.push({ value, field: SEARCH_SUGGESTION_FIELD_ENUM[field] });
    }
  }

  for (const field of SEARCH_FIELDS) {
    for (const value of remainder.get(field) ?? []) {
      if (selected.length >= boundedLimit) return selected;
      selected.push({ value, field: SEARCH_SUGGESTION_FIELD_ENUM[field] });
    }
  }

  return selected;
}
