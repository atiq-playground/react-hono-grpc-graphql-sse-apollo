/**
 * Smoke client for T05: count streamed findings and confirm Redis Stream entries.
 */
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { FindingsService, StreamRequestSchema } from "@repo/proto";
import Redis from "ioredis";

const GRPC_URL = process.env.PRODUCER_URL ?? "http://127.0.0.1:50051";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const DATASET_VERSION = process.env.DATASET_VERSION ?? "local-1";
const REDIS_STREAM = process.env.REDIS_STREAM ?? `findings:${DATASET_VERSION}`;

async function main(): Promise<void> {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  await redis.del(REDIS_STREAM);

  const transport = createGrpcTransport({
    baseUrl: GRPC_URL,
    httpVersion: "2",
  });
  const client = createClient(FindingsService, transport);

  let rows = 0;
  let blocks = 0;
  let lastSeq = 0n;
  for await (const block of client.streamFindings(
    create(StreamRequestSchema, {
      afterSequence: 0n,
      datasetVersion: DATASET_VERSION,
    }),
  )) {
    blocks += 1;
    rows += block.rowCount;
    lastSeq = block.sequence;
  }

  const streamLen = await redis.xlen(REDIS_STREAM);
  console.log(JSON.stringify({ rows, blocks, lastSeq: lastSeq.toString(), streamLen }, null, 2));

  if (rows !== 236_656) throw new Error(`expected 236656 rows, got ${rows}`);
  if (streamLen !== blocks) {
    throw new Error(`redis stream length ${streamLen} !== blocks ${blocks}`);
  }

  // Resume mid-stream: skip half the blocks
  const mid = lastSeq / 2n;
  let resumeRows = 0;
  let resumeBlocks = 0;
  for await (const block of client.streamFindings(
    create(StreamRequestSchema, {
      afterSequence: mid,
      datasetVersion: DATASET_VERSION,
    }),
  )) {
    resumeBlocks += 1;
    resumeRows += block.rowCount;
    if (block.sequence <= mid) {
      throw new Error(`resume returned sequence ${block.sequence} <= mid ${mid}`);
    }
  }
  console.log(JSON.stringify({ mid: mid.toString(), resumeRows, resumeBlocks }, null, 2));
  console.log("producer smoke passed");
  redis.disconnect();
}

main().catch((error: unknown) => {
  console.error("producer smoke failed:", error);
  process.exit(1);
});
