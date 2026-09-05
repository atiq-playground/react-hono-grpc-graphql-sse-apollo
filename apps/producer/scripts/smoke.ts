import { create } from "@bufbuild/protobuf";
import { createClient as createClickHouseClient } from "@clickhouse/client";
import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { ApplyChangesRequestSchema, IngestService } from "@repo/proto";
import { decodeDatasetEvent } from "@repo/shared";
import Redis from "ioredis";
import { rowsToFindingBlock } from "../src/block.js";
import {
  CLICKHOUSE_DB,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_URL,
  CLICKHOUSE_USER,
  DATASET_EVENTS_MAXLEN,
  DATASET_EVENTS_STREAM,
  DATASET_VERSION,
  PRODUCER_URL,
  REDIS_URL,
} from "../src/env.js";
import { normalizeFindingRow } from "../src/finding-row.js";

const EXPECTED_FINDINGS = 236_653;

async function main(): Promise<void> {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  const clickhouse = createClickHouseClient({
    url: CLICKHOUSE_URL,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: CLICKHOUSE_DB,
  });
  const transport = createGrpcTransport({
    baseUrl: PRODUCER_URL,
  });
  const client = createClient(IngestService, transport);

  try {
    const result = await clickhouse.query({
      query: `
        SELECT *, findingId, firstSeenAt, updatedAt
        FROM findings FINAL
        WHERE isDeleted = 0
        LIMIT 1
      `,
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    const sample = rows[0];
    if (!sample) throw new Error("findings FINAL returned no sample row");

    const countResult = await clickhouse.query({
      query: "SELECT count() AS count FROM findings FINAL",
      format: "JSONEachRow",
    });
    const countRows = (await countResult.json()) as Array<{ count?: string }>;
    const finalCount = Number(countRows[0]?.count ?? 0);
    if (finalCount !== EXPECTED_FINDINGS) {
      throw new Error(`expected ${EXPECTED_FINDINGS} findings under FINAL, got ${finalCount}`);
    }

    const findingId = String(sample.findingId);
    const firstSeenBefore = String(sample.firstSeenAt);
    const updatedBefore = String(sample.updatedAt);
    const streamLengthBefore = await redis.xlen(DATASET_EVENTS_STREAM);
    const response = await client.applyChanges(
      create(ApplyChangesRequestSchema, {
        datasetVersion: DATASET_VERSION,
        upserts: rowsToFindingBlock([normalizeFindingRow(sample)], 1n, DATASET_VERSION),
      }),
    );
    if (response.upsertsApplied !== 1n || response.deletesApplied !== 0n) {
      throw new Error("ApplyChanges did not report one upsert");
    }

    const eventId = response.eventIds[0];
    if (!eventId) throw new Error("ApplyChanges returned no Redis event id");
    const entries = await redis.xrange(DATASET_EVENTS_STREAM, eventId, eventId);
    const entry = entries[0];
    if (!entry) throw new Error(`Redis event ${eventId} was not found`);
    const fields = entry[1];
    const eventIndex = fields.indexOf("event");
    if (eventIndex < 0 || fields[eventIndex + 1] === undefined) {
      throw new Error(`Redis event ${eventId} has no event field`);
    }
    const event = decodeDatasetEvent(fields[eventIndex + 1]!);
    if (event.type !== "finding-upserted" || event.finding.id !== findingId) {
      throw new Error("Redis event is not the expected finding-upserted envelope");
    }

    const verifyResult = await clickhouse.query({
      query: `
        SELECT firstSeenAt, updatedAt
        FROM findings FINAL
        WHERE findingId = {findingId:String} AND isDeleted = 0
      `,
      query_params: { findingId },
      format: "JSONEachRow",
    });
    const verified = (await verifyResult.json()) as Array<{
      firstSeenAt: string;
      updatedAt: string;
    }>;
    const current = verified[0];
    if (!current) throw new Error("upserted finding is not current under FINAL");
    if (current.firstSeenAt !== firstSeenBefore) {
      throw new Error("ApplyChanges did not preserve firstSeenAt");
    }
    if (current.updatedAt <= updatedBefore) {
      throw new Error("ApplyChanges did not advance updatedAt");
    }

    const streamLength = await redis.xlen(DATASET_EVENTS_STREAM);
    const trimTolerance = Math.max(100, Math.ceil(DATASET_EVENTS_MAXLEN * 0.1));
    if (streamLength > DATASET_EVENTS_MAXLEN + trimTolerance) {
      throw new Error(
        `Redis stream length ${streamLength} exceeds configured approximate limit ${DATASET_EVENTS_MAXLEN}`,
      );
    }
    console.info(
      JSON.stringify(
        {
          finalCount,
          stream: DATASET_EVENTS_STREAM,
          streamLengthBefore,
          streamLength,
          eventId,
          eventType: event.type,
          firstSeenPreserved: true,
          updatedAtAdvanced: true,
        },
        null,
        2,
      ),
    );
    console.info("producer smoke passed");
  } finally {
    redis.disconnect();
    await clickhouse.close();
  }
}

main().catch((error: unknown) => {
  console.error("producer smoke failed:", error);
  process.exit(1);
});
