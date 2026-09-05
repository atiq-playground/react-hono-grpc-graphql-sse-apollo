import type { ClickHouseClient } from "@clickhouse/client";
import { DETAIL_FIELDS, EXPLORE_FIELDS, SEARCH_FIELDS } from "@repo/shared";
import { queryCompactRows } from "./clickhouse.js";
import { encodeCursor } from "./cursor.js";
import {
  compileFieldSelection,
  DETAIL_OUTPUT_COLUMNS,
  EXPLORE_OUTPUT_COLUMNS,
  mapExploreFinding,
  mapFindingDetail,
} from "./finding-fields.js";
import type {
  CompactQuery,
  FindingConnection,
  FindingDetailResult,
  FindingsQueryInput,
} from "./findings-query.types.js";
import { compileKeyset, compileOrderBy, compileWhere } from "./query-compiler.js";
import {
  isSearchField,
  rankSearchSuggestions,
  type SearchSuggestion,
  type SearchSuggestionRow,
} from "./search-suggestions.js";

function buildFindingsPageQuery(input: FindingsQueryInput): CompactQuery {
  const selection = compileFieldSelection(EXPLORE_FIELDS, "page_field");
  const where = compileWhere(input, { prefix: "page" });
  const keyset = compileKeyset(input, "page");
  const orderBy = compileOrderBy(input.sort, "page");

  return {
    query: `
      SELECT
        ${selection.sql},
        {page_sort_column:Identifier} AS __sortValue
      FROM findings FINAL
      WHERE ${where.sql}
      ${keyset === null ? "" : `AND ${keyset.sql}`}
      ORDER BY ${orderBy.sql}
      LIMIT {page_limit:UInt32}
    `,
    queryParams: {
      ...selection.params,
      ...where.params,
      ...keyset?.params,
      ...orderBy.params,
      page_limit: input.first + 1,
    },
    columns: [...EXPLORE_OUTPUT_COLUMNS, "__sortValue"],
    maxResultRows: input.first + 1,
  };
}

function buildTotalCountQuery(input: FindingsQueryInput): CompactQuery {
  const where = compileWhere(input, { prefix: "total" });
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

export async function findFindings(
  ch: ClickHouseClient,
  input: FindingsQueryInput,
): Promise<FindingConnection> {
  const [pageRows, countRows] = await Promise.all([
    queryCompactRows(ch, buildFindingsPageQuery(input)),
    queryCompactRows(ch, buildTotalCountQuery(input)),
  ]);

  const hasNextPage = pageRows.length > input.first;
  const boundedRows = pageRows.slice(0, input.first);
  const edges = boundedRows.map((row) => {
    const node = mapExploreFinding(row);
    const sortValue = row.__sortValue;
    if (sortValue !== null && typeof sortValue !== "string" && typeof sortValue !== "number") {
      throw new Error("ClickHouse returned an invalid cursor sort value");
    }
    return {
      node,
      cursor: encodeCursor({ s: sortValue, id: node.id }),
    };
  });

  const lastEdge = edges.at(-1);
  return {
    edges,
    pageInfo: {
      endCursor: lastEdge?.cursor ?? null,
      hasNextPage,
    },
    totalCount: Number(countRows[0]?.total ?? 0),
  };
}

function buildFindingDetailQuery(id: string): CompactQuery {
  const selection = compileFieldSelection(DETAIL_FIELDS, "detail_field");
  return {
    query: `
      SELECT ${selection.sql}
      FROM findings FINAL
      WHERE isDeleted = {detail_active:UInt8}
        AND findingId = {detail_id:String}
      LIMIT {detail_limit:UInt8}
    `,
    queryParams: {
      ...selection.params,
      detail_active: 0,
      detail_id: id,
      detail_limit: 1,
    },
    columns: DETAIL_OUTPUT_COLUMNS,
    maxResultRows: 1,
  };
}

export async function findFinding(ch: ClickHouseClient, id: string): Promise<FindingDetailResult> {
  const rows = await queryCompactRows(ch, buildFindingDetailQuery(id));
  const row = rows[0];
  return row === undefined ? null : mapFindingDetail(row);
}

function buildSearchSuggestionsQuery(prefix: string, limit: number): CompactQuery {
  const branches = SEARCH_FIELDS.map(
    (_, index) => `
      (
        SELECT
          {suggestion_column_${index}:Identifier} AS value,
          {suggestion_field_${index}:String} AS field
        FROM findings FINAL
        WHERE isDeleted = {suggestion_active:UInt8}
          AND {suggestion_column_${index}:Identifier} != {suggestion_empty:String}
          AND startsWith(
            lowerUTF8({suggestion_column_${index}:Identifier}),
            lowerUTF8({suggestion_prefix:String})
          )
        GROUP BY value, field
        ORDER BY length(value) ASC, value ASC
        LIMIT {suggestion_per_field:UInt8}
      )
    `,
  );

  return {
    query: `
      SELECT value, field
      FROM (${branches.join("\nUNION ALL\n")})
    `,
    queryParams: {
      ...Object.fromEntries(
        SEARCH_FIELDS.flatMap((column, index) => [
          [`suggestion_column_${index}`, column],
          [`suggestion_field_${index}`, column],
        ]),
      ),
      suggestion_active: 0,
      suggestion_empty: "",
      suggestion_prefix: prefix,
      suggestion_per_field: limit,
    },
    columns: ["value", "field"],
    maxResultRows: limit * SEARCH_FIELDS.length,
  };
}

export async function findSearchSuggestions(
  ch: ClickHouseClient,
  prefix: string,
  limit: number,
): Promise<readonly SearchSuggestion[]> {
  const rows = await queryCompactRows(ch, buildSearchSuggestionsQuery(prefix, limit));
  const mapped: SearchSuggestionRow[] = [];
  for (const row of rows) {
    const value = String(row.value);
    const field = String(row.field);
    if (!isSearchField(field) || value.length === 0) continue;
    mapped.push({ value, field });
  }
  return rankSearchSuggestions(mapped, limit);
}
