import { type ClickHouseClient, createClient } from "@clickhouse/client";
import {
  formatClickHouseDateTime,
  isoFromClickHouseDateTime,
  nullableIsoFromClickHouseDateTime,
  parseClickHouseDateTime,
} from "@repo/shared";
import type {
  AppliedDelete,
  AppliedUpsert,
  ClickHouseFindingRow,
  ClickHouseWriterOptions,
  CurrentFindingRow,
} from "./clickhouse-writer.types.js";
import { CLICKHOUSE_DB, CLICKHOUSE_PASSWORD, CLICKHOUSE_URL, CLICKHOUSE_USER } from "./env.js";
import { type FindingRow, normalizeFindingRow } from "./finding-row.js";

const IDENTITY_FIELDS = [
  "group",
  "repo",
  "image",
  "cve",
  "packageName",
  "packageVersion",
  "path",
] as const;

function identityKey(row: Pick<FindingRow, (typeof IDENTITY_FIELDS)[number]>): string {
  return JSON.stringify(IDENTITY_FIELDS.map((field) => row[field]));
}

function parseCurrentRow(raw: Readonly<Record<string, unknown>>): CurrentFindingRow {
  return {
    ...normalizeFindingRow(raw),
    findingId: String(raw.findingId ?? ""),
    updatedAt: isoFromClickHouseDateTime(raw.updatedAt),
    firstSeenAt: isoFromClickHouseDateTime(raw.firstSeenAt),
    isDeleted: Number(raw.isDeleted) === 1 ? 1 : 0,
    publishedAt: nullableIsoFromClickHouseDateTime(raw.publishedAt),
    fixedAt: nullableIsoFromClickHouseDateTime(raw.fixedAt),
  };
}

function toAppliedUpsert(row: CurrentFindingRow): AppliedUpsert {
  return {
    row,
    eventFinding: {
      id: row.findingId,
      cve: row.cve,
      severity: row.severity,
      cvss: row.cvss,
      status: row.status,
      packageName: row.packageName,
      packageVersion: row.packageVersion,
      group: row.group,
      repo: row.repo,
      image: row.image,
      kaiStatus: row.kaiStatus,
      publishedAt: row.publishedAt,
    },
  };
}

function identityPredicate(rows: readonly FindingRow[]): {
  query: string;
  params: Record<string, unknown>;
} {
  const params: Record<string, unknown> = {};
  const clauses = rows.map((row, rowIndex) => {
    const fields = IDENTITY_FIELDS.map((field) => {
      const parameter = `identity_${rowIndex}_${field}`;
      params[parameter] = row[field];
      return `\`${field}\` = {${parameter}:String}`;
    });
    return `(${fields.join(" AND ")})`;
  });
  return { query: clauses.join(" OR "), params };
}

async function queryRows(
  client: ClickHouseClient,
  query: string,
  queryParams?: Record<string, unknown>,
): Promise<CurrentFindingRow[]> {
  const result = await client.query({
    query,
    query_params: queryParams,
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as Array<Record<string, unknown>>;
  return rows.map(parseCurrentRow);
}

export function createProducerClickHouseClient(): ClickHouseClient {
  return createClient({
    url: CLICKHOUSE_URL,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: CLICKHOUSE_DB,
  });
}

export class ClickHouseWriter {
  readonly #client: ClickHouseClient;
  #lastVersionEpoch = 0;

  constructor({ client }: ClickHouseWriterOptions) {
    this.#client = client;
  }

  async countFinal(): Promise<number> {
    const result = await this.#client.query({
      query: "SELECT count() AS count FROM findings FINAL",
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{ count?: string }>;
    return Number(rows[0]?.count ?? 0);
  }

  async truncate(): Promise<void> {
    await this.#client.command({ query: "TRUNCATE TABLE findings" });
  }

  async insertInitial(rows: readonly FindingRow[]): Promise<void> {
    if (rows.length === 0) return;
    const timestamp = formatClickHouseDateTime(this.#nextVersionEpoch());
    const values: ClickHouseFindingRow[] = rows.map((row) => ({
      ...row,
      updatedAt: timestamp,
      firstSeenAt: timestamp,
      isDeleted: 0,
    }));
    await this.#insert(values);
  }

  async applyUpserts(rows: readonly FindingRow[]): Promise<AppliedUpsert[]> {
    if (rows.length === 0) return [];
    const unique = new Set(rows.map(identityKey));
    if (unique.size !== rows.length) {
      throw new Error("ApplyChanges upserts must have unique finding identities");
    }

    const existing = await this.#selectByIdentity(rows);
    const existingByIdentity = new Map(existing.map((row) => [identityKey(row), row]));
    const values: ClickHouseFindingRow[] = rows.map((row) => {
      const previous = existingByIdentity.get(identityKey(row));
      const firstSeenEpoch = previous
        ? parseClickHouseDateTime(previous.firstSeenAt).getTime()
        : Date.now();
      const updatedEpoch = this.#nextVersionEpoch(previous?.updatedAt);
      return {
        ...row,
        firstSeenAt: formatClickHouseDateTime(firstSeenEpoch),
        updatedAt: formatClickHouseDateTime(updatedEpoch),
        isDeleted: 0,
      };
    });
    await this.#insert(values);

    const current = await this.#selectByIdentity(rows);
    const currentByIdentity = new Map(current.map((row) => [identityKey(row), row]));
    return rows.map((row) => {
      const applied = currentByIdentity.get(identityKey(row));
      if (!applied) throw new Error("ClickHouse did not return an applied upsert");
      return toAppliedUpsert(applied);
    });
  }

  async applyDeletes(findingIds: readonly string[]): Promise<AppliedDelete[]> {
    if (findingIds.length === 0) return [];
    const existing = await this.#selectByFindingIds(findingIds);
    const byId = new Map(existing.map((row) => [row.findingId, row]));
    const missing = findingIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new Error(`Cannot delete unknown finding ids: ${missing.join(", ")}`);
    }

    const tombstones: ClickHouseFindingRow[] = findingIds.map((id) => {
      const previous = byId.get(id)!;
      return {
        ...normalizeFindingRow(previous),
        firstSeenAt: formatClickHouseDateTime(
          parseClickHouseDateTime(previous.firstSeenAt).getTime(),
        ),
        updatedAt: formatClickHouseDateTime(this.#nextVersionEpoch(previous.updatedAt)),
        isDeleted: 1,
      };
    });
    await this.#insert(tombstones);
    return findingIds.map((id) => ({ id }));
  }

  async sampleCurrent(): Promise<FindingRow | null> {
    const rows = await queryRows(
      this.#client,
      "SELECT *, findingId, publishedAt, fixedAt FROM findings FINAL WHERE isDeleted = 0 LIMIT 1",
    );
    const row = rows[0];
    return row ? normalizeFindingRow(row) : null;
  }

  async #insert(rows: readonly ClickHouseFindingRow[]): Promise<void> {
    await this.#client.insert({
      table: "findings",
      values: rows,
      format: "JSONEachRow",
    });
  }

  #nextVersionEpoch(previous?: string): number {
    const previousEpoch = previous === undefined ? 0 : parseClickHouseDateTime(previous).getTime();
    const next = Math.max(Date.now(), previousEpoch + 1, this.#lastVersionEpoch + 1);
    this.#lastVersionEpoch = next;
    return next;
  }

  async #selectByIdentity(rows: readonly FindingRow[]): Promise<CurrentFindingRow[]> {
    const predicate = identityPredicate(rows);
    return queryRows(
      this.#client,
      `SELECT *, findingId, publishedAt, fixedAt
       FROM findings FINAL
       WHERE isDeleted = 0 AND (${predicate.query})`,
      predicate.params,
    );
  }

  async #selectByFindingIds(findingIds: readonly string[]): Promise<CurrentFindingRow[]> {
    const params: Record<string, unknown> = {};
    const predicates = findingIds.map((id, index) => {
      const parameter = `finding_id_${index}`;
      params[parameter] = id;
      return `findingId = {${parameter}:String}`;
    });
    return queryRows(
      this.#client,
      `SELECT *, findingId, publishedAt, fixedAt
       FROM findings FINAL
       WHERE isDeleted = 0 AND (${predicates.join(" OR ")})`,
      params,
    );
  }
}
