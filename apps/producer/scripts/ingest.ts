/**
 * Streaming ETL: flatten groups -> repos -> images -> vulnerabilities[] into
 * ClickHouse `findings` without parsing the full JSON into memory (T04).
 *
 * Usage: bunx nx run producer:ingest
 * Flags: --force  truncate and reload when the table is already populated
 */

import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { type FindingBlock, IngestService } from "@repo/proto";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import Assembler from "stream-json/Assembler.js";
import { rowsToFindingBlock } from "../src/block.js";
import { DATASET_VERSION, INGEST_SOURCE, PRODUCER_BLOCK_SIZE, PRODUCER_URL } from "../src/env.js";
import { type FindingRow, normalizeSourceFinding } from "../src/finding-row.js";

type JsonAssembler = {
  depth: number;
  current: unknown;
  consume: (token: { name: string; value?: unknown }) => boolean;
};

const AssemblerCtor = Assembler as unknown as new () => JsonAssembler;

/** Source vulnerability records streamed from the corpus. */
const EXPECTED_ROWS = 236_656;
/**
 * Distinct findings after ReplacingMergeTree dedup on the identity key
 * (group, repo, image, cve, packageName, packageVersion, path): three source
 * records are exact identity duplicates that differ only in status/fixDate text.
 */
const EXPECTED_FINDINGS = 236_653;

type Token = { name: string; value?: unknown };

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

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const transport = createGrpcTransport({
    baseUrl: PRODUCER_URL,
  });
  const client = createClient(IngestService, transport);

  const started = Date.now();
  let peakRss = process.memoryUsage().rss;
  const trackMem = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 250);

  try {
    console.info(
      `Ingesting ${basename(INGEST_SOURCE)} through ${PRODUCER_URL} in blocks of ${PRODUCER_BLOCK_SIZE}...`,
    );
    let streamedRows = 0;
    let streamedBlocks = 0n;

    async function* blocks(): AsyncGenerator<FindingBlock> {
      let batch: FindingRow[] = [];
      for await (const row of iterateFindings(INGEST_SOURCE)) {
        batch.push(row);
        if (batch.length >= PRODUCER_BLOCK_SIZE) {
          streamedBlocks += 1n;
          streamedRows += batch.length;
          yield rowsToFindingBlock(batch, streamedBlocks, DATASET_VERSION);
          batch = [];
          if (streamedRows % 20_000 === 0) {
            console.info(`  progress: ${streamedRows} source rows`);
          }
        }
      }
      if (batch.length > 0) {
        streamedBlocks += 1n;
        streamedRows += batch.length;
        yield rowsToFindingBlock(batch, streamedBlocks, DATASET_VERSION);
      }
    }

    const response = await client.ingestBlocks(blocks(), {
      headers: { "x-ingest-replace": force ? "true" : "false" },
    });
    const isFullCorpus = basename(INGEST_SOURCE) === "ui_demo.json";
    if (Number(response.sourceRowsWritten) !== streamedRows) {
      throw new Error(
        `streamed ${streamedRows} source rows, producer wrote ${response.sourceRowsWritten}`,
      );
    }
    if (response.blocksWritten !== streamedBlocks) {
      throw new Error(
        `producer wrote ${response.blocksWritten} blocks, client streamed ${streamedBlocks}`,
      );
    }
    if (isFullCorpus) {
      if (streamedRows !== EXPECTED_ROWS) {
        throw new Error(
          `expected ${EXPECTED_ROWS} source rows for full corpus, streamed ${streamedRows}`,
        );
      }
      if (Number(response.currentFindings) !== EXPECTED_FINDINGS) {
        throw new Error(
          `expected ${EXPECTED_FINDINGS} findings under FINAL for full corpus, got ${response.currentFindings}`,
        );
      }
    }
    console.info(
      `Done: ${streamedRows} source rows -> ${response.currentFindings} FINAL findings in ${((Date.now() - started) / 1000).toFixed(1)}s; peak RSS ${(peakRss / 1024 / 1024).toFixed(1)} MiB`,
    );
    console.info(`Terminal DatasetEvent: ${response.terminalEventId}`);
    console.info("ingest accepted");
  } finally {
    clearInterval(trackMem);
  }
}

main().catch((error: unknown) => {
  console.error("ingest failed:", error);
  process.exit(1);
});
