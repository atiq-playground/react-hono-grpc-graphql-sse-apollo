/**
 * Single registry of finding fields (ADR-0001). Field names are the GraphQL
 * `Finding` field names and the ClickHouse `findings` v2 column names, so the
 * gateway (selection sets, identifier allowlists), the producer (DatasetEvent
 * payloads), and the dashboard (grid columns, filters, sort, search) share one
 * vocabulary. `id` is the ClickHouse `findingId`.
 */
import { z } from "zod/mini";

import type {
  FindingFieldDefinition,
  FindingFieldGroup,
  FindingFieldKind,
  FindingFieldName,
  FindingRecord,
} from "./finding-fields.types.js";

export type {
  DetailField,
  ExploreField,
  ExploreFinding,
  FilterField,
  FindingDetail,
  FindingFieldDefinition,
  FindingFieldGroup,
  FindingFieldKind,
  FindingFieldName,
  FindingFieldValue,
  FindingRecord,
  SearchField,
  SortField,
} from "./finding-fields.types.js";

/** Every finding field with its wire-level scalar kind, in detail (display) order. */
export const FINDING_FIELD_KINDS = {
  id: "string",
  group: "string",
  repo: "string",
  image: "string",
  cve: "string",
  severity: "string",
  cvss: "number",
  status: "string",
  packageName: "string",
  packageVersion: "string",
  packageType: "string",
  path: "string",
  advisoryType: "string",
  buildType: "string",
  type: "string",
  description: "string",
  cause: "string",
  exploit: "string",
  fixDate: "string",
  published: "string",
  layerTime: "string",
  link: "string",
  owner: "string",
  vecStr: "string",
  kaiStatus: "nullableString",
  riskFactors: "stringArray",
  applicableRules: "stringArray",
  publishedAt: "nullableDateString",
  fixedAt: "nullableDateString",
  updatedAt: "dateString",
} as const satisfies Record<string, FindingFieldKind>;

export const FINDING_FIELD_NAMES = Object.keys(FINDING_FIELD_KINDS) as readonly FindingFieldName[];

/** Row fields the Explore grid renders, in column order. */
export const EXPLORE_FIELDS = [
  "id",
  "cve",
  "severity",
  "cvss",
  "status",
  "packageName",
  "packageVersion",
  "group",
  "repo",
  "image",
  "kaiStatus",
  "publishedAt",
] as const satisfies readonly FindingFieldName[];

/** Fields the detail view requests: every registered field. */
export const DETAIL_FIELDS: readonly FindingFieldName[] = FINDING_FIELD_NAMES;

/** Fields that accept multi-value equality filters (and drive facets). */
export const FILTER_FIELDS = [
  "severity",
  "status",
  "group",
  "repo",
  "image",
  "packageType",
  "advisoryType",
  "kaiStatus",
  "riskFactors",
] as const satisfies readonly FindingFieldName[];

/** Fields the server may order by (keyset cursor pairs them with `id`). */
export const SORT_FIELDS = [
  "cvss",
  "severity",
  "cve",
  "publishedAt",
  "fixedAt",
  "packageName",
  "repo",
  "updatedAt",
] as const satisfies readonly FindingFieldName[];

/** Fields matched by free-text search and prefix suggestions. */
export const SEARCH_FIELDS = [
  "cve",
  "packageName",
  "image",
  "repo",
] as const satisfies readonly FindingFieldName[];

export const FINDING_FIELD_GROUPS = {
  explore: EXPLORE_FIELDS,
  detail: DETAIL_FIELDS,
  filterable: FILTER_FIELDS,
  sortable: SORT_FIELDS,
  searchable: SEARCH_FIELDS,
} as const;

const FINDING_FIELD_GROUP_NAMES = Object.keys(FINDING_FIELD_GROUPS) as readonly FindingFieldGroup[];

function groupsOf(name: FindingFieldName): readonly FindingFieldGroup[] {
  return FINDING_FIELD_GROUP_NAMES.filter((group) =>
    (FINDING_FIELD_GROUPS[group] as readonly FindingFieldName[]).includes(name),
  );
}

/** Registry entries derived from the kind map and group tuples above. */
export const FINDING_FIELDS: readonly FindingFieldDefinition[] = FINDING_FIELD_NAMES.map(
  (name) => ({
    name,
    kind: FINDING_FIELD_KINDS[name],
    groups: groupsOf(name),
  }),
);

export function isFindingField(value: string): value is FindingFieldName {
  return Object.hasOwn(FINDING_FIELD_KINDS, value);
}

export function fieldsIn<Group extends FindingFieldGroup>(
  group: Group,
): (typeof FINDING_FIELD_GROUPS)[Group] {
  return FINDING_FIELD_GROUPS[group];
}

/** Space-separated GraphQL selection set for a field group, e.g. inside `node { ... }`. */
export function selectionSet(group: FindingFieldGroup): string {
  return FINDING_FIELD_GROUPS[group].join(" ");
}

// [schemas]

export const FindingIdSchema = z.string().check(z.regex(/^[0-9a-f]{32}$/));

const ISO_DATE_TIME = z.iso.datetime({ offset: true });

const FIELD_KIND_SCHEMAS = {
  string: z.string(),
  number: z.number(),
  nullableString: z.nullable(z.string()),
  stringArray: z.array(z.string()),
  dateString: ISO_DATE_TIME,
  nullableDateString: z.nullable(ISO_DATE_TIME),
} as const satisfies Record<FindingFieldKind, z.ZodMiniType>;

/** Builds a strict object schema for the given fields using their registered kinds. */
export function findingRecordSchema<const Fields extends readonly FindingFieldName[]>(
  fields: Fields,
): z.ZodMiniType<FindingRecord<Fields[number]>> {
  const shape: Record<string, z.ZodMiniType> = {};
  for (const field of fields) {
    shape[field] =
      field === "id" ? FindingIdSchema : FIELD_KIND_SCHEMAS[FINDING_FIELD_KINDS[field]];
  }
  // The shape is assembled dynamically from the registry; the kind map guarantees
  // each key's schema output matches FindingFieldValue<key>.
  return z.object(shape) as unknown as z.ZodMiniType<FindingRecord<Fields[number]>>;
}

export const ExploreFindingSchema = findingRecordSchema(EXPLORE_FIELDS);
export const FindingDetailSchema = findingRecordSchema(FINDING_FIELD_NAMES);

export function isFindingId(value: string): boolean {
  return FindingIdSchema.safeParse(value).success;
}

export function parseFindingId(value: unknown): string {
  return FindingIdSchema.parse(value);
}
