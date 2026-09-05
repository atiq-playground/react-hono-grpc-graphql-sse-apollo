/**
 * Ensure Redis Stream is populated by opening a producer gRPC stream (T05→T06).
 * Idempotent: concurrent callers share one in-flight fill.
 */
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { FindingsService, StreamRequestSchema } from "@repo/proto";
import Redis from "ioredis";

const PRODUCER_URL = process.env.PRODUCER_URL ?? "http://127.0.0.1:50051";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const DATASET_VERSION = process.env.DATASET_VERSION ?? "local-1";

let fillPromise: Promise<void> | null = null;

export async function ensureProducerStream(
  streamKey: string,
  sentryTrace?: string,
  baggage?: string,
): Promise<void> {
  if (fillPromise) return fillPromise;

  fillPromise = (async () => {
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    try {
      const len = await redis.xlen(streamKey);
      if (len > 0) return;
    } finally {
      redis.disconnect();
    }

    const transport = createGrpcTransport({
      baseUrl: PRODUCER_URL,
    });
    const client = createClient(FindingsService, transport);
    const headers = new Headers();
    if (sentryTrace) headers.set("sentry-trace", sentryTrace);
    if (baggage) headers.set("baggage", baggage);

    for await (const _block of client.streamFindings(
      create(StreamRequestSchema, {
        afterSequence: 0n,
        datasetVersion: DATASET_VERSION,
      }),
      { headers },
    )) {
      // Drain; producer publishes to Redis as a side effect.
    }
  })().finally(() => {
    fillPromise = null;
  });

  return fillPromise;
}
