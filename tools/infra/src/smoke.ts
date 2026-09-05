/**
 * Smoke checks for local ClickHouse + Redis (T02).
 * Requires the compose stack to be healthy.
 *
 * Usage (from repo root, after `bun install` in tools/infra or workspace):
 *   bun run tools/infra/src/smoke.ts
 */
import { createClient } from "@clickhouse/client";
import Redis from "ioredis";

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

const clickhouseUrl = env("CLICKHOUSE_URL", "http://localhost:8123");
const clickhouseUser = env("CLICKHOUSE_USER", "default");
const clickhousePassword = env("CLICKHOUSE_PASSWORD", "");
const clickhouseDatabase = env("CLICKHOUSE_DB", "default");
const redisUrl = env("REDIS_URL", "redis://localhost:6379");
const redisChannel = env("REDIS_SMOKE_CHANNEL", "svd:infra:smoke");

async function smokeClickHouse(): Promise<void> {
  const client = createClient({
    url: clickhouseUrl,
    username: clickhouseUser,
    password: clickhousePassword,
    database: clickhouseDatabase,
  });

  try {
    const describe = await client.query({
      query: "DESCRIBE TABLE findings",
      format: "JSONEachRow",
    });
    const columns = (await describe.json()) as Array<{ name: string; type: string }>;
    if (columns.length === 0) {
      throw new Error("findings table DESCRIBE returned no columns");
    }

    const required = [
      "group",
      "repo",
      "image",
      "cve",
      "severity",
      "packageType",
      "status",
      "advisoryType",
      "buildType",
      "kaiStatus",
      "riskFactors",
      "applicableRules",
    ];
    const names = new Set(columns.map((c) => c.name));
    for (const name of required) {
      if (!names.has(name)) {
        throw new Error(`findings schema missing column: ${name}`);
      }
    }

    const marker = `smoke-${Date.now()}`;
    await client.insert({
      table: "findings",
      values: [
        {
          group: "smoke-group",
          repo: "smoke-repo",
          image: "smoke-image",
          cve: marker,
          severity: "low",
          packageName: "smoke-pkg",
          packageVersion: "0.0.0",
          packageType: "npm",
          path: "",
          status: "open",
          advisoryType: "nvd",
          buildType: "",
          type: "vuln",
          cvss: 0,
          description: "infra smoke row",
          cause: "",
          exploit: "",
          fixDate: "",
          published: "",
          layerTime: "",
          link: "",
          owner: "",
          vecStr: "",
          kaiStatus: null,
          riskFactors: ["smoke-factor"],
          applicableRules: ["smoke-rule"],
        },
      ],
      format: "JSONEachRow",
    });

    const selected = await client.query({
      query: "SELECT cve FROM findings WHERE cve = {cve:String} LIMIT 1",
      query_params: { cve: marker },
      format: "JSONEachRow",
    });
    const rows = (await selected.json()) as Array<{ cve: string }>;
    if (rows[0]?.cve !== marker) {
      throw new Error("ClickHouse INSERT/SELECT round trip failed");
    }

    await client.command({
      query: "ALTER TABLE findings DELETE WHERE cve = {cve:String}",
      query_params: { cve: marker },
    });

    console.log(`ClickHouse OK (${columns.length} columns; INSERT/SELECT round trip)`);
  } finally {
    await client.close();
  }
}

async function smokeRedis(): Promise<void> {
  const subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  const publisher = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });

  try {
    await subscriber.connect();
    await publisher.connect();

    const payload = `smoke-${Date.now()}`;
    const received = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Redis SUBSCRIBE timed out")), 5_000);
      subscriber.on("message", (channel, message) => {
        if (channel === redisChannel) {
          clearTimeout(timer);
          resolve(message);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(redisChannel, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const listeners = await publisher.publish(redisChannel, payload);
    if (listeners < 1) {
      throw new Error("Redis PUBLISH reported zero subscribers");
    }

    const message = await received;
    if (message !== payload) {
      throw new Error("Redis PUBLISH/SUBSCRIBE payload mismatch");
    }

    console.log("Redis OK (PUBLISH/SUBSCRIBE across two connections)");
  } finally {
    subscriber.disconnect();
    publisher.disconnect();
  }
}

async function main(): Promise<void> {
  await smokeClickHouse();
  await smokeRedis();
  console.log("infra smoke passed");
}

main().catch((error: unknown) => {
  console.error("infra smoke failed:", error);
  process.exit(1);
});
