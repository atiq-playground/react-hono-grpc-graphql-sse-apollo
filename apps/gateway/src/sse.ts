/**
 * SSE data plane: relay Redis Stream finding blocks as base64 frames (T06).
 *
 * Approach: one Redis connection per SSE client reading the stream with XREAD.
 * History replay uses Last-Event-ID (block sequence). Live tail uses BLOCK.
 * This is simpler than a shared fan-out for local scale; note for later.
 *
 * Envelope (T14): optional first `stream-meta` event carries sentry-trace/baggage
 * so the browser can continue the distributed trace (SSE frames have no headers).
 */
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import { z } from "zod/mini";
import { REDIS_STREAM, REDIS_URL } from "./env.js";
import { ensureProducerStream } from "./producer-client.js";

const XREAD_COUNT = 32;
const XREAD_BLOCK_MS = 5_000;
const KEEPALIVE_MS = 15_000;

const StreamQuery = z.object({
  datasetVersion: z.optional(z.string()),
});

type StreamEntry = [id: string, fields: string[]];
type XReadResult = Array<[stream: string, entries: StreamEntry[]]> | null;

function fieldsToMap(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    if (key !== undefined && value !== undefined) out[key] = value;
  }
  return out;
}

function parseLastEventId(header: string | undefined): bigint {
  if (header === undefined || header === "") return 0n;
  if (!/^\d+$/.test(header)) {
    throw new Error("Malformed Last-Event-ID; expected an unsigned integer sequence");
  }
  return BigInt(header);
}

function streamKeyFor(datasetVersion: string | undefined): string {
  if (datasetVersion === undefined) return REDIS_STREAM;
  return `findings:${datasetVersion}`;
}

export async function sseRoute(c: Context): Promise<Response> {
  const queryParse = StreamQuery.safeParse({
    datasetVersion: c.req.query("datasetVersion"),
  });
  if (!queryParse.success) {
    return c.json({ error: "Invalid query parameters" }, 400);
  }

  let afterSeq: bigint;
  try {
    afterSeq = parseLastEventId(c.req.header("Last-Event-ID"));
  } catch {
    return c.json({ error: "Invalid Last-Event-ID" }, 400);
  }

  const streamKey = streamKeyFor(queryParse.data.datasetVersion);
  const sentryTrace = c.req.header("sentry-trace");
  const baggage = c.req.header("baggage");

  // Kick producer fill if Redis is empty (does not block first frames once filled).
  void ensureProducerStream(streamKey, sentryTrace, baggage);

  return streamSSE(c, async (stream) => {
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    let cursor = "0-0";
    let lastEmitted = afterSeq;
    let alive = true;

    const onAbort = () => {
      alive = false;
      redis.disconnect();
    };
    c.req.raw.signal.addEventListener("abort", onAbort);

    const keepalive = setInterval(() => {
      if (alive) void stream.writeSSE({ event: "keepalive", data: "" });
    }, KEEPALIVE_MS);

    try {
      await stream.writeSSE({
        event: "stream-meta",
        data: JSON.stringify({
          sentryTrace: sentryTrace ?? null,
          baggage: baggage ?? null,
        }),
      });

      // Replay existing entries with seq > afterSeq, then block for new ones.
      while (alive) {
        const result = (await redis.xread(
          "COUNT",
          XREAD_COUNT,
          "BLOCK",
          XREAD_BLOCK_MS,
          "STREAMS",
          streamKey,
          cursor,
        )) as XReadResult;

        if (!result) continue;

        for (const [, entries] of result) {
          for (const [id, fields] of entries) {
            cursor = id;
            const map = fieldsToMap(fields);
            const seq = BigInt(map.seq ?? "0");
            const payload = map.payload;
            if (!payload) continue;
            if (seq <= lastEmitted) continue;
            lastEmitted = seq;
            await stream.writeSSE({
              id: seq.toString(),
              event: "finding-block",
              data: payload,
            });
          }
        }
      }
    } finally {
      clearInterval(keepalive);
      c.req.raw.signal.removeEventListener("abort", onAbort);
      redis.disconnect();
    }
  });
}
