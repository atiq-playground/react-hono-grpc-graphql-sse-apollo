import {
  DETAIL_FIELDS,
  EXPLORE_FIELDS,
  type ExploreFinding,
  ExploreFindingSchema,
  FINDING_FIELD_KINDS,
  type FindingDetail,
  FindingDetailSchema,
  type FindingFieldName,
  isoFromClickHouseDateTime,
  nullableIsoFromClickHouseDateTime,
} from "@repo/shared";
import type { QueryParameters } from "./findings-query.types.js";

export const EXPLORE_OUTPUT_COLUMNS = EXPLORE_FIELDS;
export const DETAIL_OUTPUT_COLUMNS = DETAIL_FIELDS;

function clickHouseColumn(field: FindingFieldName): string {
  return field === "id" ? "findingId" : field;
}

export function compileFieldSelection(
  fields: readonly FindingFieldName[],
  prefix: string,
): { readonly sql: string; readonly params: QueryParameters } {
  return {
    sql: fields.map((_, index) => `{${prefix}_${index}:Identifier}`).join(",\n"),
    params: Object.fromEntries(
      fields.map((field, index) => [`${prefix}_${index}`, clickHouseColumn(field)]),
    ),
  };
}

function mapValue(field: FindingFieldName, value: unknown): unknown {
  const kind = FINDING_FIELD_KINDS[field];
  if (kind === "dateString") return isoFromClickHouseDateTime(value);
  if (kind === "nullableDateString") return nullableIsoFromClickHouseDateTime(value);
  if (kind === "number") return Number(value);
  return value;
}

function mapFinding(
  row: Readonly<Record<string, unknown>>,
  fields: readonly FindingFieldName[],
): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field, mapValue(field, row[field])]));
}

export function mapExploreFinding(row: Readonly<Record<string, unknown>>): ExploreFinding {
  return ExploreFindingSchema.parse(mapFinding(row, EXPLORE_FIELDS));
}

export function mapFindingDetail(row: Readonly<Record<string, unknown>>): FindingDetail {
  return FindingDetailSchema.parse(mapFinding(row, DETAIL_FIELDS));
}
