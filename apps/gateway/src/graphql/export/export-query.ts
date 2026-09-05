import type { ClickHouseClient } from "@clickhouse/client";
import { EXPLORE_FIELDS, FINDING_FIELD_KINDS, type FindingFieldName } from "@repo/shared";
import { queryCompactRows } from "../clickhouse.js";
import type { CompactQuery, ExportQueryInput, QueryParameters } from "../findings-query.types.js";
import { compileOrderBy, compileWhere } from "../query-compiler.js";

export const CLICKHOUSE_EXPORT_SETTINGS = {
  max_execution_time: 300,
  max_rows_to_read: "10000000",
  max_bytes_to_read: "5000000000",
  max_memory_usage: "536870912",
  max_bytes_before_external_sort: "134217728",
  timeout_before_checking_execution_speed: 0,
  format_csv_delimiter: ",",
} as const;

export interface ExportStatement {
  readonly query: string;
  readonly queryParams: QueryParameters;
}

function clickHouseColumn(field: FindingFieldName): string {
  return field === "id" ? "findingId" : field;
}

/**
 * Every non-numeric cell is converted to text and guarded in ClickHouse before
 * CSV serialization. A leading single quote makes formula prefixes inert in
 * spreadsheet clients; CSVWithNames still owns delimiter, quote, and newline
 * escaping. Fields and aliases come only from the shared Explore allowlist.
 */
function compileSpreadsheetSafeSelection(): {
  readonly sql: string;
  readonly params: QueryParameters;
} {
  const params: QueryParameters = {
    export_formula_prefix: "^[=+\\-@\t\r]",
    export_formula_escape: "'",
  };
  const expressions = EXPLORE_FIELDS.map((field, index) => {
    const columnParameter = `export_field_${index}`;
    const aliasParameter = `export_alias_${index}`;
    params[columnParameter] = clickHouseColumn(field);
    params[aliasParameter] = field;

    if (FINDING_FIELD_KINDS[field] === "number") {
      return `{${columnParameter}:Identifier} AS {${aliasParameter}:Identifier}`;
    }

    const value = `ifNull(toString({${columnParameter}:Identifier}), '')`;
    return `if(
      match(${value}, {export_formula_prefix:String}),
      concat({export_formula_escape:String}, ${value}),
      ${value}
    ) AS {${aliasParameter}:Identifier}`;
  });

  return { sql: expressions.join(",\n"), params };
}

export function buildExportStatement(input: ExportQueryInput): ExportStatement {
  const selection = compileSpreadsheetSafeSelection();
  const where = compileWhere(input, { prefix: "export" });
  const orderBy = compileOrderBy(input.sort, "export");
  return {
    query: `
      SELECT
        ${selection.sql}
      FROM findings FINAL
      WHERE ${where.sql}
      ORDER BY ${orderBy.sql}
      FORMAT CSVWithNames
    `,
    queryParams: {
      ...selection.params,
      ...where.params,
      ...orderBy.params,
    },
  };
}

function buildExportCountQuery(input: ExportQueryInput): CompactQuery {
  const where = compileWhere(input, { prefix: "export_count" });
  return {
    query: `
      SELECT count() AS total
      FROM findings FINAL
      WHERE ${where.sql}
    `,
    queryParams: where.params,
    columns: ["total"],
    maxResultRows: 1,
  };
}

export async function countExportRows(
  ch: ClickHouseClient,
  input: ExportQueryInput,
): Promise<number> {
  const rows = await queryCompactRows(ch, buildExportCountQuery(input));
  const rowCount = Number(rows[0]?.total ?? 0);
  if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > 2_147_483_647) {
    throw new Error("ClickHouse returned an invalid export row count");
  }
  return rowCount;
}
