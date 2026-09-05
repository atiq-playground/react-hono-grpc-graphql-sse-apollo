/// <reference types="jest" />

import { encodeDatasetEvent, parseDatasetEvent } from "@repo/shared";
import type Redis from "ioredis";
import { DATASET_EVENTS_COALESCE_THRESHOLD, DATASET_VERSION } from "./env.js";
import { coalesceStreamBatch, createResyncRequiredEvent } from "./sse-coalescing.js";
import {
  parseLastEventId,
  resolveStartPosition,
  type ValidatedStreamEntry,
} from "./sse-redis-stream.js";

const at = "2026-09-05T12:00:00.000Z";

function deletion(index: number): ValidatedStreamEntry {
  return {
    id: `${1_000 + index}-0`,
    event: parseDatasetEvent({
      v: 1,
      type: "finding-deleted",
      datasetVersion: DATASET_VERSION,
      at,
      id: index.toString(16).padStart(32, "0"),
    }),
  };
}

function fakeRedis(firstId: string, lastId: string, retainedIds: readonly string[]): Redis {
  return {
    xrange: async (_stream: string, start: string, end: string) => {
      if (start === "-" && end === "+") return [[firstId, ["event", "{}"]]];
      return retainedIds.includes(start) ? [[start, ["event", "{}"]]] : [];
    },
    xrevrange: async () => [[lastId, ["event", "{}"]]],
  } as unknown as Redis;
}

describe("Redis Stream replay boundaries", () => {
  it("starts new subscribers at the tail and retained subscribers after their exact id", async () => {
    expect(await resolveStartPosition(fakeRedis("10-0", "20-0", []), undefined)).toEqual({
      cursor: "$",
    });
    expect(await resolveStartPosition(fakeRedis("10-0", "20-0", ["15-0"]), "15-0")).toEqual({
      cursor: "15-0",
    });
  });

  it.each([
    ["trimmed", "9-0"],
    ["missing inside bounds", "15-0"],
    ["future", "21-0"],
  ])("requires resync for a %s cursor", async (_label, cursor) => {
    expect(await resolveStartPosition(fakeRedis("10-0", "20-0", []), cursor)).toEqual({
      cursor: "20-0",
      resyncId: "20-0",
    });
  });

  it("validates Last-Event-ID without conflating it with GraphQL cursors", () => {
    expect(parseLastEventId(undefined)).toBeUndefined();
    expect(parseLastEventId("")).toBeUndefined();
    expect(parseLastEventId("1720000000000-0")).toBe("1720000000000-0");
    for (const invalid of ["$", "01-0", "1", "1--0", "-1-0", "opaque-cursor"]) {
      expect(() => parseLastEventId(invalid)).toThrow();
    }
  });
});

describe("SSE burst coalescing", () => {
  it("preserves small batches and coalesces bursts into bounded JSON invalidations", () => {
    const small = [deletion(0), deletion(1)];
    expect(coalesceStreamBatch(small)).toEqual(small);

    const burst = Array.from({ length: DATASET_EVENTS_COALESCE_THRESHOLD + 1 }, (_, index) =>
      deletion(index),
    );
    const coalesced = coalesceStreamBatch(burst);
    expect(coalesced.map(({ event }) => event.type)).toEqual([
      "aggregates-invalidated",
      "findings-changed",
    ]);
    expect(coalesced.at(-1)?.id).toBe(burst.at(-1)?.id);
    const changed = coalesced.find(({ event }) => event.type === "findings-changed")?.event;
    expect(changed?.type === "findings-changed" ? changed.ids : []).toHaveLength(burst.length);
    expect(encodeDatasetEvent(coalesced[0]!.event)).not.toMatch(/finding-block|base64/i);
  });

  it("creates a versioned JSON resync event", () => {
    const event = createResyncRequiredEvent();
    expect(event).toMatchObject({
      v: 1,
      type: "resync-required",
      datasetVersion: DATASET_VERSION,
    });
    expect(() => JSON.parse(encodeDatasetEvent(event))).not.toThrow();
  });
});
