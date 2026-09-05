import { type DatasetEvent, decodeDatasetEvent } from "@repo/shared";
import type Redis from "ioredis";
import { z } from "zod/mini";

import { DATASET_EVENTS_STREAM, DATASET_VERSION } from "./env.js";

const XREAD_COUNT = 256;

// [schemas]

const RedisStreamIdSchema = z
  .string()
  .check(z.maxLength(64), z.regex(/^(0|[1-9]\d*)-(0|[1-9]\d*)$/));

// [types]

type StreamEntry = [id: string, fields: string[]];
type XReadResult = Array<[stream: string, entries: StreamEntry[]]> | null;
type StreamRangeResult = StreamEntry[];

export interface ValidatedStreamEntry {
  readonly id: string;
  readonly event: DatasetEvent;
}

interface StreamBounds {
  readonly firstId: string;
  readonly lastId: string;
}

export interface StartPosition {
  readonly cursor: string;
  readonly resyncId?: string;
}

interface RedisStreamId {
  readonly milliseconds: bigint;
  readonly sequence: bigint;
}

export function parseLastEventId(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  return RedisStreamIdSchema.parse(value);
}

function parseRedisStreamId(value: string): RedisStreamId {
  const parsed = RedisStreamIdSchema.parse(value);
  const [milliseconds, sequence] = parsed.split("-");
  return {
    milliseconds: BigInt(milliseconds ?? "0"),
    sequence: BigInt(sequence ?? "0"),
  };
}

function compareRedisStreamIds(left: string, right: string): number {
  const a = parseRedisStreamId(left);
  const b = parseRedisStreamId(right);
  if (a.milliseconds !== b.milliseconds) return a.milliseconds < b.milliseconds ? -1 : 1;
  if (a.sequence === b.sequence) return 0;
  return a.sequence < b.sequence ? -1 : 1;
}

function fieldValue(fields: readonly string[], name: string): string | undefined {
  for (let index = 0; index < fields.length; index += 2) {
    if (fields[index] === name) return fields[index + 1];
  }
  return undefined;
}

function validateEntry([id, fields]: StreamEntry): ValidatedStreamEntry {
  RedisStreamIdSchema.parse(id);
  const payload = fieldValue(fields, "event");
  if (payload === undefined) {
    throw new Error(`Redis DatasetEvent entry ${id} has no event field`);
  }
  const event = decodeDatasetEvent(payload);
  if (event.datasetVersion !== DATASET_VERSION) {
    throw new Error(`Redis DatasetEvent entry ${id} has the wrong datasetVersion`);
  }
  return { id, event };
}

function flattenXRead(result: XReadResult): ValidatedStreamEntry[] {
  if (result === null) return [];
  return result.flatMap(([, entries]) => entries.map(validateEntry));
}

async function readStreamBounds(redis: Redis): Promise<StreamBounds | undefined> {
  const first = (await redis.xrange(
    DATASET_EVENTS_STREAM,
    "-",
    "+",
    "COUNT",
    1,
  )) as StreamRangeResult;
  if (first[0] === undefined) return undefined;

  const last = (await redis.xrevrange(
    DATASET_EVENTS_STREAM,
    "+",
    "-",
    "COUNT",
    1,
  )) as StreamRangeResult;
  if (last[0] === undefined) return undefined;
  return { firstId: first[0][0], lastId: last[0][0] };
}

export async function resolveStartPosition(
  redis: Redis,
  lastEventId: string | undefined,
): Promise<StartPosition> {
  if (lastEventId === undefined) return { cursor: "$" };

  const bounds = await readStreamBounds(redis);
  const retainedEntry =
    bounds === undefined
      ? []
      : ((await redis.xrange(
          DATASET_EVENTS_STREAM,
          lastEventId,
          lastEventId,
          "COUNT",
          1,
        )) as StreamRangeResult);
  if (
    bounds === undefined ||
    compareRedisStreamIds(lastEventId, bounds.firstId) < 0 ||
    compareRedisStreamIds(lastEventId, bounds.lastId) > 0 ||
    retainedEntry[0]?.[0] !== lastEventId
  ) {
    if (bounds === undefined) return { cursor: "$" };
    return { cursor: bounds.lastId, resyncId: bounds.lastId };
  }
  return { cursor: lastEventId };
}

export async function readStreamEntries(
  redis: Redis,
  cursor: string,
  blockMilliseconds: number,
): Promise<ValidatedStreamEntry[]> {
  const result = (await redis.xread(
    "COUNT",
    XREAD_COUNT,
    "BLOCK",
    Math.max(1, blockMilliseconds),
    "STREAMS",
    DATASET_EVENTS_STREAM,
    cursor,
  )) as XReadResult;
  return flattenXRead(result);
}
