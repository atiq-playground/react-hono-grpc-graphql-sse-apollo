import type {
  EXPLORE_FIELDS,
  FILTER_FIELDS,
  FINDING_FIELD_GROUPS,
  FINDING_FIELD_KINDS,
  SEARCH_FIELDS,
  SORT_FIELDS,
} from "./finding-fields.js";

/**
 * Wire-level scalar kinds. Date kinds carry ISO 8601 strings; the ClickHouse
 * `DateTime` columns are formatted by the gateway before they reach a client.
 */
export type FindingFieldKind =
  | "string"
  | "number"
  | "nullableString"
  | "stringArray"
  | "dateString"
  | "nullableDateString";

export type FindingFieldName = keyof typeof FINDING_FIELD_KINDS;
export type FindingFieldGroup = keyof typeof FINDING_FIELD_GROUPS;

export type ExploreField = (typeof EXPLORE_FIELDS)[number];
export type DetailField = FindingFieldName;
export type FilterField = (typeof FILTER_FIELDS)[number];
export type SortField = (typeof SORT_FIELDS)[number];
export type SearchField = (typeof SEARCH_FIELDS)[number];

export interface FindingFieldDefinition {
  readonly name: FindingFieldName;
  readonly kind: FindingFieldKind;
  readonly groups: readonly FindingFieldGroup[];
}

interface FindingFieldKindValues {
  string: string;
  number: number;
  nullableString: string | null;
  stringArray: string[];
  dateString: string;
  nullableDateString: string | null;
}

export type FindingFieldValue<Field extends FindingFieldName> =
  FindingFieldKindValues[(typeof FINDING_FIELD_KINDS)[Field]];

/** Object shape holding exactly the given finding fields with their wire types. */
export type FindingRecord<Field extends FindingFieldName> = {
  readonly [Key in Field]: FindingFieldValue<Key>;
};

/** Row shape shown by the Explore grid and carried by `finding-upserted` events. */
export type ExploreFinding = FindingRecord<ExploreField>;

/** Full record shape returned by `finding(id)`. */
export type FindingDetail = FindingRecord<FindingFieldName>;
