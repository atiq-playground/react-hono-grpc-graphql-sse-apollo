import type { ClickHouseClient } from "@clickhouse/client";
import type { ExploreFinding } from "@repo/shared";

import type { FindingRow } from "./finding-row.js";

export interface ClickHouseFindingRow extends FindingRow {
  updatedAt: string;
  firstSeenAt: string;
  isDeleted: 0 | 1;
}

export interface CurrentFindingRow extends ClickHouseFindingRow {
  findingId: string;
  publishedAt: string | null;
  fixedAt: string | null;
}

export interface AppliedUpsert {
  row: CurrentFindingRow;
  eventFinding: ExploreFinding;
}

export interface AppliedDelete {
  id: string;
}

export interface ClickHouseWriterOptions {
  client: ClickHouseClient;
}
