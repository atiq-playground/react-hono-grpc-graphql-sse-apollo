/**
 * Producer gRPC server: stream FindingBlocks from ClickHouse and publish each
 * encoded block to a Redis Stream for gateway fan-out / resume (T05).
 *
 * Block size defaults to 2048 rows (~116 blocks for the full corpus) — small
 * enough for early first paint, large enough to keep framing overhead low.
 *
 * Resume policy: `after_sequence` skips already-sent blocks. Each block's
 * dictionary is self-contained (re-encoded per block) so resume does not need
 * prior dictionary state.
 */

import http2 from "node:http2";
import { toBinary } from "@bufbuild/protobuf";
import { createClient } from "@clickhouse/client";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { type FindingBlock, FindingBlockSchema, FindingsService } from "@repo/proto";
import Redis from "ioredis";
import { BLOCK_SIZE, rowsToFindingBlock } from "./block.js";
import { type FindingRow, normalizeFindingRow } from "./finding-row.js";
import { initProducerSentry } from "./sentry.js";

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

const DATASET_VERSION = env("DATASET_VERSION", "local-1");
const REDIS_URL = env("REDIS_URL", "redis://127.0.0.1:6379");
const REDIS_STREAM = env("REDIS_STREAM", `findings:${DATASET_VERSION}`);
const GRPC_HOST = env("PRODUCER_HOST", "127.0.0.1");
const GRPC_PORT = Number(env("PRODUCER_PORT", "50051"));

function parseRow(raw: Record<string, unknown>): FindingRow {
  return normalizeFindingRow(raw);
}

async function* streamBlocks(afterSequence: bigint): AsyncGenerator<{
  sequence: bigint;
  binary: Uint8Array;
  block: FindingBlock;
}> {
  const clickhouse = createClient({
    url: env("CLICKHOUSE_URL", "http://127.0.0.1:8123"),
    username: env("CLICKHOUSE_USER", "default"),
    password: env("CLICKHOUSE_PASSWORD", ""),
    database: env("CLICKHOUSE_DB", "default"),
  });

  try {
    const result = await clickhouse.query({
      query: `
        SELECT *
        FROM findings
        ORDER BY \`group\`, repo, image, severity, cve
      `,
      format: "JSONEachRow",
    });

    const stream = result.stream<Record<string, unknown>>();
    let batch: FindingRow[] = [];
    let sequence = 0n;

    const flush = function* () {
      if (batch.length === 0) return;
      sequence += 1n;
      const rows = batch;
      batch = [];
      if (sequence <= afterSequence) return;
      const block = rowsToFindingBlock(rows, sequence, DATASET_VERSION);
      yield {
        sequence,
        binary: toBinary(FindingBlockSchema, block),
        block,
      };
    };

    for await (const chunk of stream) {
      for (const raw of chunk) {
        const rowRecord =
          typeof (raw as { json?: unknown }).json === "function"
            ? (raw as { json: () => Record<string, unknown> }).json()
            : (raw as unknown as Record<string, unknown>);
        batch.push(parseRow(rowRecord));
        if (batch.length >= BLOCK_SIZE) {
          yield* flush();
        }
      }
    }
    yield* flush();
  } finally {
    await clickhouse.close();
  }
}

async function main(): Promise<void> {
  initProducerSentry();
  const server = http2.createServer(
    connectNodeAdapter({
      routes: (router) => {
        router.service(FindingsService, {
          async *streamFindings(req, ctx) {
            // T14: continue browser→gateway→producer trace via gRPC metadata.
            const sentryTrace = ctx.requestHeader.get("sentry-trace");
            const baggage = ctx.requestHeader.get("baggage");
            void sentryTrace;
            void baggage;

            const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
            try {
              for await (const { sequence, binary, block } of streamBlocks(req.afterSequence)) {
                // Backpressure: await Redis write before yielding the next block.
                await redis.xadd(
                  REDIS_STREAM,
                  "*",
                  "seq",
                  sequence.toString(),
                  "payload",
                  Buffer.from(binary).toString("base64"),
                  ...(sentryTrace
                    ? (["sentryTrace", sentryTrace, "baggage", baggage ?? ""] as const)
                    : []),
                );
                yield block;
              }
            } finally {
              redis.disconnect();
            }
          },
        });
      },
    }),
  );

  await new Promise<void>((resolve, reject) => {
    server.listen(GRPC_PORT, GRPC_HOST, () => resolve());
    server.on("error", reject);
  });
  console.log(
    `producer listening on http://${GRPC_HOST}:${GRPC_PORT} dataset=${DATASET_VERSION} stream=${REDIS_STREAM} blockSize=${BLOCK_SIZE}`,
  );

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("producer failed:", error);
  process.exit(1);
});
