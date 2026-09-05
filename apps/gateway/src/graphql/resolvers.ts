import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ClickHouseClient, createClient } from "@clickhouse/client";
import { z } from "zod/mini";
import { throwClientError } from "./errors.js";

const DATASET_VERSION = process.env.DATASET_VERSION ?? "local-1";
const REDIS_STREAM = process.env.REDIS_STREAM ?? `findings:${DATASET_VERSION}`;

const FindingId = z.object({
  group: z.string(),
  repo: z.string(),
  image: z.string(),
  cve: z.string(),
  packageName: z.string(),
  path: z.string(),
});

const FacetColumn = z.enum([
  "severity",
  "packageType",
  "status",
  "advisoryType",
  "group",
  "repo",
  "kaiStatus",
]);

export type GatewayContext = {
  ch: ClickHouseClient;
};

export function createClickHouse(): ClickHouseClient {
  return createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://127.0.0.1:8123",
    username: process.env.CLICKHOUSE_USER ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
    database: process.env.CLICKHOUSE_DB ?? "default",
  });
}

export function loadTypeDefs(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "schema.graphql"), "utf8");
}

function encodeFindingId(row: {
  group: string;
  repo: string;
  image: string;
  cve: string;
  packageName: string;
  path: string;
}): string {
  return Buffer.from(JSON.stringify(row), "utf8").toString("base64url");
}

function decodeFindingId(id: string): z.infer<typeof FindingId> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
    return FindingId.parse(parsed);
  } catch {
    throwClientError("Invalid finding id");
  }
}

async function queryJson<T>(
  ch: ClickHouseClient,
  query: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ch.query({
    query,
    query_params,
    format: "JSONEachRow",
  });
  return (await result.json()) as T[];
}

export async function queryFacet(
  ch: ClickHouseClient,
  requestedColumn: unknown,
): Promise<Array<{ value: string; count: number }>> {
  const parsedColumn = FacetColumn.safeParse(requestedColumn);
  if (!parsedColumn.success) {
    throwClientError("Invalid facet column");
  }

  const rows = await queryJson<{ value: string; count: string }>(
    ch,
    `
    SELECT ifNull(toString({column:Identifier}), '') AS value, count() AS count
    FROM findings
    GROUP BY value
    ORDER BY count DESC
    LIMIT 500
    `,
    { column: parsedColumn.data },
  );
  return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
}

export const resolvers = {
  Query: {
    async summary(_parent: unknown, _args: unknown, ctx: GatewayContext) {
      const rows = await queryJson<{
        total: string;
        analysisCount: string;
        aiAnalysisCount: string;
      }>(
        ctx.ch,
        `
        SELECT
          count() AS total,
          countIf(kaiStatus IS NULL OR kaiStatus != 'invalid - norisk') AS analysisCount,
          countIf(kaiStatus IS NULL OR kaiStatus != 'ai-invalid-norisk') AS aiAnalysisCount
        FROM findings
        `,
      );
      const severityRows = await queryJson<{ severity: string; count: string }>(
        ctx.ch,
        `
        SELECT severity, count() AS count
        FROM findings
        GROUP BY severity
        ORDER BY count DESC
        `,
      );
      const row = rows[0];
      if (!row) throw new Error("summary query returned no rows");
      return {
        total: Number(row.total),
        analysisCount: Number(row.analysisCount),
        aiAnalysisCount: Number(row.aiAnalysisCount),
        bySeverity: severityRows.map((s) => ({
          severity: s.severity,
          count: Number(s.count),
        })),
      };
    },

    async facets(_parent: unknown, _args: unknown, ctx: GatewayContext) {
      return {
        severity: await queryFacet(ctx.ch, "severity"),
        packageType: await queryFacet(ctx.ch, "packageType"),
        status: await queryFacet(ctx.ch, "status"),
        advisoryType: await queryFacet(ctx.ch, "advisoryType"),
        group: await queryFacet(ctx.ch, "group"),
        repo: await queryFacet(ctx.ch, "repo"),
        kaiStatus: await queryFacet(ctx.ch, "kaiStatus"),
      };
    },

    async finding(_parent: unknown, args: { id: string }, ctx: GatewayContext) {
      const key = decodeFindingId(args.id);
      const rows = await queryJson<Record<string, unknown>>(
        ctx.ch,
        `
        SELECT *
        FROM findings
        WHERE
          \`group\` = {group:String}
          AND repo = {repo:String}
          AND image = {image:String}
          AND cve = {cve:String}
          AND packageName = {packageName:String}
          AND path = {path:String}
        LIMIT 1
        `,
        key,
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: args.id,
        group: String(row.group ?? ""),
        repo: String(row.repo ?? ""),
        image: String(row.image ?? ""),
        cve: String(row.cve ?? ""),
        severity: String(row.severity ?? ""),
        packageName: String(row.packageName ?? ""),
        packageVersion: String(row.packageVersion ?? ""),
        packageType: String(row.packageType ?? ""),
        path: String(row.path ?? ""),
        status: String(row.status ?? ""),
        advisoryType: String(row.advisoryType ?? ""),
        buildType: String(row.buildType ?? ""),
        type: String(row.type ?? ""),
        cvss: Number(row.cvss ?? 0),
        description: String(row.description ?? ""),
        cause: String(row.cause ?? ""),
        exploit: String(row.exploit ?? ""),
        fixDate: String(row.fixDate ?? ""),
        published: String(row.published ?? ""),
        layerTime: String(row.layerTime ?? ""),
        link: String(row.link ?? ""),
        owner: String(row.owner ?? ""),
        vecStr: String(row.vecStr ?? ""),
        kaiStatus:
          row.kaiStatus === null || row.kaiStatus === undefined ? null : String(row.kaiStatus),
        riskFactors: Array.isArray(row.riskFactors) ? row.riskFactors.map((v) => String(v)) : [],
        applicableRules: Array.isArray(row.applicableRules)
          ? row.applicableRules.map((v) => String(v))
          : [],
      };
    },

    async streamDescriptor(_parent: unknown, _args: unknown, ctx: GatewayContext) {
      const rows = await queryJson<{ total: string }>(
        ctx.ch,
        `SELECT count() AS total FROM findings`,
      );
      const total = Number(rows[0]?.total ?? 0);
      return {
        datasetVersion: DATASET_VERSION,
        totalRecords: total,
        cursor: "0",
        redisStream: REDIS_STREAM,
        ssePath: "/api/stream",
      };
    },
  },
};

export { encodeFindingId };
