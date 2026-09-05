/**
 * Query-shape contracts for the `findings` connection: filters, sort, cursor.
 * The gateway compiles them to parameterized ClickHouse predicates; the
 * dashboard carries them in URL state and Apollo variables.
 */
import { z } from "zod/mini";

import { FILTER_FIELDS, SORT_FIELDS } from "./finding-fields.js";

export const FINDING_FILTER_MAX_VALUES = 50;
export const FINDING_FILTER_MAX_VALUE_LENGTH = 256;
export const FINDING_CURSOR_MAX_LENGTH = 512;
export const SORT_DIRECTIONS = ["asc", "desc"] as const;

declare const findingCursorBrand: unique symbol;

// [schemas]

/** Filterable field -> selected values (OR within a field, AND across fields). */
export const FindingFiltersSchema = z.partialRecord(
  z.enum(FILTER_FIELDS),
  z
    .array(z.string().check(z.maxLength(FINDING_FILTER_MAX_VALUE_LENGTH)))
    .check(z.maxLength(FINDING_FILTER_MAX_VALUES)),
);

export const FindingSortSchema = z.object({
  field: z.enum(SORT_FIELDS),
  direction: z.enum(SORT_DIRECTIONS),
});

/**
 * Opaque keyset cursor issued by the gateway (`pageInfo.endCursor`). Clients
 * pass it back unchanged; only the server knows and validates its encoding.
 */
export const FindingCursorSchema = z
  .string()
  .check(z.minLength(1), z.maxLength(FINDING_CURSOR_MAX_LENGTH));

// [types]

export type FindingFilters = z.infer<typeof FindingFiltersSchema>;
export type FindingSort = z.infer<typeof FindingSortSchema>;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
export type FindingCursor = string & { readonly [findingCursorBrand]: true };

export function parseFindingFilters(value: unknown): FindingFilters {
  return FindingFiltersSchema.parse(value);
}

export function parseFindingSort(value: unknown): FindingSort {
  return FindingSortSchema.parse(value);
}

export function parseFindingCursor(value: unknown): FindingCursor {
  return FindingCursorSchema.parse(value) as FindingCursor;
}
