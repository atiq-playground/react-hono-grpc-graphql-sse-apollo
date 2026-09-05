import type { ClickHouseClient } from "@clickhouse/client";
import { FILTER_FIELDS, type FilterField } from "@repo/shared";
import { queryCompactRows } from "./clickhouse.js";
import type {
  CompactQuery,
  FacetsQueryInput,
  FacetsResult,
  QueryParameters,
} from "./findings-query.types.js";
import { compileWhere } from "./query-compiler.js";

const FACET_LIMIT = 200;

function buildFacetBranch(
  input: FacetsQueryInput,
  field: FilterField,
  index: number,
): { readonly sql: string; readonly params: QueryParameters } {
  const prefix = `facet_${index}`;
  const where = compileWhere({ ...input, search: null }, { prefix, excludeFilter: field });
  const valueExpression =
    field === "riskFactors"
      ? `arrayJoin({${prefix}_column:Identifier})`
      : `ifNull(toString({${prefix}_column:Identifier}), '')`;

  return {
    sql: `
      SELECT {${prefix}_name:String} AS facet, value, count
      FROM (
        SELECT ${valueExpression} AS value, count() AS count
        FROM findings FINAL
        WHERE ${where.sql}
        GROUP BY value
        ORDER BY count DESC, value ASC
        LIMIT {${prefix}_limit:UInt16}
      )
    `,
    params: {
      ...where.params,
      [`${prefix}_name`]: field,
      [`${prefix}_column`]: field,
      [`${prefix}_limit`]: FACET_LIMIT,
    },
  };
}

function buildFacetsQuery(input: FacetsQueryInput): CompactQuery {
  const branches = FILTER_FIELDS.map((field, index) => buildFacetBranch(input, field, index));
  return {
    query: branches.map((branch) => branch.sql).join("\nUNION ALL\n"),
    queryParams: Object.assign({}, ...branches.map((branch) => branch.params)),
    columns: ["facet", "value", "count"],
    maxResultRows: FILTER_FIELDS.length * FACET_LIMIT,
  };
}

export async function findFacets(
  ch: ClickHouseClient,
  input: FacetsQueryInput,
): Promise<FacetsResult> {
  const rows = await queryCompactRows(ch, buildFacetsQuery(input));
  const grouped: Record<FilterField, Array<{ value: string; count: number }>> = {
    severity: [],
    status: [],
    group: [],
    repo: [],
    image: [],
    packageType: [],
    advisoryType: [],
    kaiStatus: [],
    riskFactors: [],
  };

  for (const row of rows) {
    const field = String(row.facet) as FilterField;
    if (!FILTER_FIELDS.includes(field)) {
      throw new Error("ClickHouse returned an unexpected facet field");
    }
    grouped[field].push({
      value: String(row.value),
      count: Number(row.count),
    });
  }
  return grouped;
}
