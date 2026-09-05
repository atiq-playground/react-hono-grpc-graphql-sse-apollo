/**
 * DatasetEvent v1 (ADR-0001): small notifications about changes to one Dataset
 * Version. The producer publishes them to a Redis Stream, the gateway relays
 * them over SSE, and the browser applies or refetches. Events describe data;
 * they are not a data transport. Encoding lives in `dataset-event-codec.ts`.
 */
import { z } from "zod/mini";

import { ExploreFindingSchema } from "./finding-fields.js";

export const DATASET_EVENT_VERSION = 1 as const;

export const DATASET_EVENT_TYPES = [
  "finding-upserted",
  "finding-deleted",
  "findings-changed",
  "aggregates-invalidated",
  "dataset-version-changed",
  "export-ready",
  "resync-required",
] as const;

export const AGGREGATE_SCOPES = ["overview", "facets", "findings"] as const;

/** Upper bound for ids carried by one coalesced `findings-changed` event. */
export const DATASET_EVENT_MAX_CHANGED_IDS = 5000;

const BoundedId = z.string().check(z.minLength(1), z.maxLength(128));

function eventType<Type extends DatasetEventType>(type: Type) {
  return z.literal(type);
}

const base = {
  v: z.literal(DATASET_EVENT_VERSION),
  datasetVersion: BoundedId,
  at: z.iso.datetime({ offset: true }),
};

// [schemas]

export const DatasetEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: eventType("finding-upserted"), finding: ExploreFindingSchema }),
  z.object({ ...base, type: eventType("finding-deleted"), id: BoundedId }),
  z.object({
    ...base,
    type: eventType("findings-changed"),
    ids: z.array(BoundedId).check(z.minLength(1), z.maxLength(DATASET_EVENT_MAX_CHANGED_IDS)),
  }),
  z.object({
    ...base,
    type: eventType("aggregates-invalidated"),
    scopes: z
      .array(z.enum(AGGREGATE_SCOPES))
      .check(z.minLength(1), z.maxLength(AGGREGATE_SCOPES.length)),
  }),
  z.object({ ...base, type: eventType("dataset-version-changed") }),
  z.object({
    ...base,
    type: eventType("export-ready"),
    jobId: BoundedId,
    url: z.optional(z.string().check(z.maxLength(2048))),
  }),
  z.object({ ...base, type: eventType("resync-required") }),
]);

// [types]

export type DatasetEventType = (typeof DATASET_EVENT_TYPES)[number];
export type AggregateScope = (typeof AGGREGATE_SCOPES)[number];
export type DatasetEvent = z.infer<typeof DatasetEventSchema>;
export type DatasetEventOf<Type extends DatasetEventType> = Extract<DatasetEvent, { type: Type }>;

const _everyEventTypeHasASchema: [DatasetEventType] extends [DatasetEvent["type"]] ? true : never =
  true;

export function parseDatasetEvent(value: unknown): DatasetEvent {
  return DatasetEventSchema.parse(value);
}

/** Redis Stream key shared by the producer (XADD) and gateway (XREAD). */
export function datasetEventsStreamKey(datasetVersion: string): `dataset-events:${string}` {
  return `dataset-events:${datasetVersion}`;
}
