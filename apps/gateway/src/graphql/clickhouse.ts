import type { ClickHouseClient } from "@clickhouse/client";
import type { CompactQuery } from "./findings-query.types.js";

const QUERY_SETTINGS = {
  max_execution_time: 15,
  max_rows_to_read: "10000000",
  max_bytes_to_read: "500000000",
  timeout_before_checking_execution_speed: 0,
  output_format_json_quote_64bit_integers: 1,
} as const;

/**
 * Executes a bounded positional result. JSONCompactEachRow avoids repeating
 * column names on every row; callers declare the exact output order.
 */
export async function queryCompactRows(
  ch: ClickHouseClient,
  statement: CompactQuery,
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result = await ch.query({
    query: statement.query,
    query_params: statement.queryParams,
    format: "JSONCompactEachRow",
    clickhouse_settings: {
      ...QUERY_SETTINGS,
      max_result_rows: String(statement.maxResultRows),
      result_overflow_mode: "throw",
    },
  });
  const tuples = await result.json<unknown[]>();

  return tuples.map((tuple) => {
    if (!Array.isArray(tuple) || tuple.length !== statement.columns.length) {
      throw new Error("ClickHouse returned an unexpected compact row shape");
    }
    return Object.fromEntries(statement.columns.map((column, index) => [column, tuple[index]]));
  });
}
