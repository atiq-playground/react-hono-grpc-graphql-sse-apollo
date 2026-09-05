/**
 * Streaming ETL: flatten groups -> repos -> images -> vulnerabilities[] into
 * ClickHouse `findings` without parsing the full JSON into memory (T04).
 *
 * Usage: bunx nx run producer:ingest
 * Flags: --force  truncate and reload when the table is already populated
 */

import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { type ClickHouseClient, createClient } from "@clickhouse/client";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import Assembler from "stream-json/Assembler.js";
import { type FindingRow, normalizeSourceFinding } from "../src/finding-row.js";

type JsonAssembler = {
  depth: number;
  current: unknown;
  consume: (token: { name: string; value?: unknown }) => boolean;
};

const AssemblerCtor = Assembler as unknown as new () => JsonAssembler;

const RAW_PATH = process.env.INGEST_SOURCE ?? "apps/producer/data/raw/ui_demo.json";
const BATCH_SIZE = Number(process.env.INGEST_BATCH_SIZE ?? 2_000);
const EXPECTED_ROWS = 236_656;

type Token = { name: string; value?: unknown };

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function flattenVulnerability(
  group: string,
  repo: string,
  image: string,
  imageBuildType: string,
  vuln: Record<string, unknown>,
): FindingRow {
  return normalizeSourceFinding({
    group,
    repo,
    image,
    imageBuildType,
    vulnerability: vuln,
  });
}

function consumeObject(asm: JsonAssembler, token: Token): boolean {
  asm.consume(token);
  return asm.depth === 0;
}

async function* iterateFindings(filePath: string): AsyncGenerator<FindingRow> {
  const pipeline = chain([createReadStream(filePath, { highWaterMark: 256 * 1024 }), parser()]);

  let groupName = "";
  let repoName = "";
  let imageName = "";
  let imageBuildType = "";

  /** Path of object/array containers we care about. */
  type Mode =
    | "root"
    | "groups"
    | "group"
    | "repos"
    | "repo"
    | "images"
    | "image"
    | "vulns"
    | "skip";
  const modes: Mode[] = ["root"];
  let pendingKey: string | null = null;
  let skipDepth = 0;
  let vulnAsm: JsonAssembler | null = null;

  for await (const token of pipeline as AsyncIterable<Token>) {
    if (vulnAsm) {
      if (consumeObject(vulnAsm, token)) {
        const current = vulnAsm.current;
        vulnAsm = null;
        if (current && typeof current === "object" && !Array.isArray(current)) {
          yield flattenVulnerability(
            groupName,
            repoName,
            imageName,
            imageBuildType,
            current as Record<string, unknown>,
          );
        }
      }
      continue;
    }

    if (skipDepth > 0) {
      if (token.name === "startObject" || token.name === "startArray") skipDepth += 1;
      if (token.name === "endObject" || token.name === "endArray") skipDepth -= 1;
      continue;
    }

    const mode = modes[modes.length - 1] ?? "root";

    switch (token.name) {
      case "keyValue": {
        pendingKey = String(token.value);
        break;
      }
      case "startObject": {
        if (mode === "root" && pendingKey === "groups") {
          modes.push("groups");
          pendingKey = null;
        } else if (mode === "groups") {
          groupName = pendingKey ?? "";
          modes.push("group");
          pendingKey = null;
        } else if (mode === "group" && pendingKey === "repos") {
          modes.push("repos");
          pendingKey = null;
        } else if (mode === "repos") {
          repoName = pendingKey ?? "";
          modes.push("repo");
          pendingKey = null;
        } else if (mode === "repo" && pendingKey === "images") {
          modes.push("images");
          pendingKey = null;
        } else if (mode === "images") {
          imageName = pendingKey ?? "";
          imageBuildType = "";
          modes.push("image");
          pendingKey = null;
        } else if (mode === "vulns") {
          vulnAsm = new AssemblerCtor();
          consumeObject(vulnAsm, token);
          pendingKey = null;
        } else if (pendingKey !== null) {
          // Unneeded nested object (e.g. metadata) — skip subtree.
          skipDepth = 1;
          pendingKey = null;
        }
        break;
      }
      case "endObject": {
        if (
          mode === "group" ||
          mode === "repo" ||
          mode === "image" ||
          mode === "groups" ||
          mode === "repos" ||
          mode === "images"
        ) {
          modes.pop();
        }
        pendingKey = null;
        break;
      }
      case "startArray": {
        if (mode === "image" && pendingKey === "vulnerabilities") {
          modes.push("vulns");
          pendingKey = null;
        } else {
          skipDepth = 1;
          pendingKey = null;
        }
        break;
      }
      case "endArray": {
        if (mode === "vulns") modes.pop();
        pendingKey = null;
        break;
      }
      case "stringValue":
      case "numberValue":
      case "trueValue":
      case "falseValue":
      case "nullValue": {
        const value =
          token.name === "trueValue"
            ? true
            : token.name === "falseValue"
              ? false
              : token.name === "nullValue"
                ? null
                : token.value;
        if (mode === "group" && pendingKey === "name") groupName = asString(value);
        if (mode === "repo" && pendingKey === "name") repoName = asString(value);
        if (mode === "image" && pendingKey === "name") imageName = asString(value);
        if (mode === "image" && pendingKey === "buildType") {
          imageBuildType = asString(value);
        }
        pendingKey = null;
        break;
      }
      default:
        break;
    }
  }
}

async function insertBatch(client: ClickHouseClient, rows: FindingRow[]): Promise<void> {
  if (rows.length === 0) return;
  await client.insert({
    table: "findings",
    values: rows,
    format: "JSONEachRow",
  });
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const client = createClient({
    url: env("CLICKHOUSE_URL", "http://127.0.0.1:8123"),
    username: env("CLICKHOUSE_USER", "default"),
    password: env("CLICKHOUSE_PASSWORD", ""),
    database: env("CLICKHOUSE_DB", "default"),
  });

  const started = Date.now();
  let peakRss = process.memoryUsage().rss;
  const trackMem = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 250);

  try {
    const countResult = await client.query({
      query: "SELECT count() AS c FROM findings",
      format: "JSONEachRow",
    });
    const countRows = (await countResult.json()) as Array<{ c: string }>;
    const existing = Number(countRows[0]?.c ?? 0);

    if (existing > 0 && !force) {
      throw new Error(`findings already has ${existing} rows; refuse to ingest without --force`);
    }
    if (existing > 0 && force) {
      console.log(`Truncating findings (${existing} rows) due to --force`);
      await client.command({ query: "TRUNCATE TABLE findings" });
    }

    console.log(`Ingesting ${basename(RAW_PATH)} in batches of ${BATCH_SIZE}...`);
    let batch: FindingRow[] = [];
    let total = 0;

    for await (const row of iterateFindings(RAW_PATH)) {
      batch.push(row);
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(client, batch);
        total += batch.length;
        batch = [];
        if (total % 20_000 === 0) {
          console.log(`  progress: ${total} rows`);
        }
      }
    }
    await insertBatch(client, batch);
    total += batch.length;

    const verify = await client.query({
      query: `
        SELECT
          count() AS total,
          uniqExact(\`group\`) AS groups,
          uniqExact(image) AS images,
          countIf(kaiStatus IS NOT NULL) AS withKai
        FROM findings
      `,
      format: "JSONEachRow",
    });
    const stats = (await verify.json()) as Array<{
      total: string;
      groups: string;
      images: string;
      withKai: string;
    }>;
    const s = stats[0];
    if (!s) throw new Error("verification query returned no rows");

    const totalN = Number(s.total);
    const groupsN = Number(s.groups);
    const imagesN = Number(s.images);
    const kaiN = Number(s.withKai);

    console.log(
      `Done: ${totalN} rows in ${((Date.now() - started) / 1000).toFixed(1)}s; peak RSS ${(peakRss / 1024 / 1024).toFixed(1)} MiB`,
    );
    console.log(`Verify: groups=${groupsN} images=${imagesN} kaiStatus_present=${kaiN}`);

    // Re-inspected against the streamed source census (apps/producer/scripts/census.ts):
    // 45 groups / 1030 images in source, but one group and five images have empty
    // vulnerability arrays and therefore produce no findings rows.
    const expectedGroupsInFindings = 44;
    const expectedImagesInFindings = 1_025;

    if (totalN !== EXPECTED_ROWS) {
      throw new Error(`expected ${EXPECTED_ROWS} rows, got ${totalN}`);
    }
    if (groupsN !== expectedGroupsInFindings) {
      throw new Error(`expected ${expectedGroupsInFindings} groups in findings, got ${groupsN}`);
    }
    if (imagesN !== expectedImagesInFindings) {
      throw new Error(`expected ${expectedImagesInFindings} images in findings, got ${imagesN}`);
    }
    if (kaiN !== 29_005) {
      throw new Error(`expected 29005 kaiStatus values, got ${kaiN}`);
    }

    console.log("ingest accepted");
  } finally {
    clearInterval(trackMem);
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("ingest failed:", error);
  process.exit(1);
});
