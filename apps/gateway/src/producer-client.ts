/**
 * Ensure Redis Stream is populated by opening a producer gRPC stream (T05→T06).
 * Idempotent: concurrent callers share one in-flight fill.
 */
import { create } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { FindingsService, StreamRequestSchema } from "@repo/proto";
import Redis from "ioredis";
import { DATASET_VERSION, PRODUCER_URL, REDIS_URL } from "./env.js";

let fillPromise: Promise<void> | null = null;

export async function ensureProducerStream(
  streamKey: string,
  sentryTrace?: string,
  baggage?: string,
): Promise<void> {
  if (fillPromise) return fillPromise;

  fillPromise = fillRedisIfEmpty(streamKey, sentryTrace, baggage).finally(() => {
    fillPromise = null;
  });

  return fillPromise;
}

async function fillRedisIfEmpty(
  streamKey: string,
  sentryTrace?: string,
  baggage?: string,
): Promise<void> {
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
}
