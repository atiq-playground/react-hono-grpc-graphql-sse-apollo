/**
 * SSE data plane: relay validated DatasetEvents from one configured Redis
 * Stream. Each client owns a blocking Redis connection; this is intentionally
 * simple for local scale and can be replaced by a shared fan-out if measured
 * connection pressure warrants it.
 */
import { encodeDatasetEvent } from "@repo/shared";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import { z } from "zod/mini";

import { DATASET_VERSION, REDIS_URL } from "./env.js";
import {
  coalesceStreamBatch,
  collectStreamWindow,
  createResyncRequiredEvent,
} from "./sse-coalescing.js";
import { parseLastEventId, readStreamEntries, resolveStartPosition } from "./sse-redis-stream.js";

const XREAD_BLOCK_MS = 5_000;
const KEEPALIVE_MS = 15_000;

// [schemas]

const StreamQuery = z.object({
  datasetVersion: z.optional(z.literal(DATASET_VERSION)),
});

function parseRequest(c: Context): { lastEventId?: string } | Response {
  const searchParams = new URL(c.req.url).searchParams;
  const keys = [...searchParams.keys()];
  if (
    keys.some((key) => key !== "datasetVersion") ||
    searchParams.getAll("datasetVersion").length > 1
  ) {
    return c.json({ error: "Invalid query parameters; only one datasetVersion is allowed" }, 400);
  }

  const queryParse = StreamQuery.safeParse({
    datasetVersion: searchParams.get("datasetVersion") ?? undefined,
  });
  if (!queryParse.success) {
    return c.json({ error: `Invalid datasetVersion; expected ${DATASET_VERSION}` }, 400);
  }

  try {
    const lastEventId = parseLastEventId(c.req.header("Last-Event-ID"));
    return lastEventId === undefined ? {} : { lastEventId };
  } catch {
    return c.json(
      { error: "Invalid Last-Event-ID; expected a Redis Stream id such as 1720000000000-0" },
      400,
    );
  }
}

export async function sseRoute(c: Context): Promise<Response> {
  const request = parseRequest(c);
  if (request instanceof Response) return request;

  // Hono's CompressionStream middleware offers no per-frame flush control.
  // Keep SSE identity-encoded so events and keepalives cannot be buffered.
  c.header("Content-Encoding", "identity");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    let alive = true;
    let nextKeepaliveAt = Date.now() + KEEPALIVE_MS;
    // Flush immediately so proxies cannot hold the response until Redis work
    // or the first retained event; EventSource stays CONNECTING until then.
    await stream.write(": connected\n\n");

    const onAbort = () => {
      alive = false;
      redis.disconnect();
    };
    c.req.raw.signal.addEventListener("abort", onAbort);

    try {
      const start = await resolveStartPosition(redis, request.lastEventId);
      let cursor = start.cursor;
      if (start.resyncId !== undefined) {
        const event = createResyncRequiredEvent();
        await stream.writeSSE({
          id: start.resyncId,
          event: event.type,
          data: encodeDatasetEvent(event),
        });
      } else if (request.lastEventId !== undefined && cursor === "$") {
        const event = createResyncRequiredEvent();
        await stream.writeSSE({
          event: event.type,
          data: encodeDatasetEvent(event),
        });
      }

      while (alive) {
        const untilKeepalive = Math.max(1, nextKeepaliveAt - Date.now());
        const entries = await readStreamEntries(
          redis,
          cursor,
          Math.min(XREAD_BLOCK_MS, untilKeepalive),
        );
        if (!alive) break;

        if (entries.length > 0) {
          const batch = await collectStreamWindow(redis, entries);
          cursor = batch.at(-1)?.id ?? cursor;
          for (const { id, event } of coalesceStreamBatch(batch)) {
            await stream.writeSSE({
              id,
              event: event.type,
              data: encodeDatasetEvent(event),
            });
          }
        }

        if (Date.now() >= nextKeepaliveAt) {
          await stream.write(": keepalive\n\n");
          nextKeepaliveAt = Date.now() + KEEPALIVE_MS;
        }
      }
    } catch (error: unknown) {
      if (alive) throw error;
    } finally {
      c.req.raw.signal.removeEventListener("abort", onAbort);
      redis.disconnect();
    }
  });
}
