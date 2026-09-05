import type { ClickHouseClient } from "@clickhouse/client";
import type Redis from "ioredis";
import { DATASET_EVENTS_STREAM, DATASET_VERSION } from "../env.js";
import { queryCompactRows } from "./clickhouse.js";
import type { CompactQuery } from "./findings-query.types.js";

const DATASET_COUNT_QUERY: CompactQuery = {
  query: `
    SELECT count() AS total
    FROM findings FINAL
    WHERE isDeleted = {dataset_active:UInt8}
  `,
  queryParams: { dataset_active: 0 },
  columns: ["total"],
  maxResultRows: 1,
};

export interface DatasetInfo {
  readonly version: string;
  readonly totalCount: number;
  readonly lastEventId: string | null;
}

export async function findDatasetInfo(ch: ClickHouseClient, redis: Redis): Promise<DatasetInfo> {
  const [countRows, entries] = await Promise.all([
    queryCompactRows(ch, DATASET_COUNT_QUERY),
    redis.xrevrange(DATASET_EVENTS_STREAM, "+", "-", "COUNT", 1),
  ]);
  return {
    version: DATASET_VERSION,
    totalCount: Number(countRows[0]?.total ?? 0),
    lastEventId: entries[0]?.[0] ?? null,
  };
}
