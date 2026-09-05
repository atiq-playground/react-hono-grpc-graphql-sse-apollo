import {
  AGGREGATE_SCOPES,
  type AggregateScope,
  DATASET_EVENT_MAX_CHANGED_IDS,
  type DatasetEvent,
  parseDatasetEvent,
} from "@repo/shared";
import type Redis from "ioredis";

import {
  DATASET_EVENTS_COALESCE_THRESHOLD,
  DATASET_EVENTS_COALESCE_WINDOW_MS,
  DATASET_VERSION,
} from "./env.js";
import { readStreamEntries, type ValidatedStreamEntry } from "./sse-redis-stream.js";

function isCoalescible(event: DatasetEvent): boolean {
  return (
    event.type === "finding-upserted" ||
    event.type === "finding-deleted" ||
    event.type === "findings-changed" ||
    event.type === "aggregates-invalidated"
  );
}

function changedIds(event: DatasetEvent): readonly string[] {
  switch (event.type) {
    case "finding-upserted":
      return [event.finding.id];
    case "finding-deleted":
      return [event.id];
    case "findings-changed":
      return event.ids;
    default:
      return [];
  }
}

function eventBase(at: string): Pick<DatasetEvent, "v" | "datasetVersion" | "at"> {
  return { v: 1, datasetVersion: DATASET_VERSION, at };
}

function coalesceRun(entries: readonly ValidatedStreamEntry[]): ValidatedStreamEntry[] {
  const first = entries[0];
  const last = entries.at(-1);
  if (first === undefined || last === undefined) return [];

  const ids = new Set<string>();
  const scopes = new Set<AggregateScope>();
  let idsOverflowed = false;

  for (const { event } of entries) {
    for (const id of changedIds(event)) {
      if (ids.size < DATASET_EVENT_MAX_CHANGED_IDS) ids.add(id);
      else if (!ids.has(id)) idsOverflowed = true;
    }
    if (event.type === "aggregates-invalidated") {
      for (const scope of event.scopes) scopes.add(scope);
    }
  }

  const emitted: ValidatedStreamEntry[] = [];
  if (ids.size > 0) {
    for (const scope of AGGREGATE_SCOPES) scopes.add(scope);
  } else if (idsOverflowed) {
    scopes.add("findings");
  }

  if (scopes.size > 0) {
    emitted.push({
      id: ids.size > 0 ? first.id : last.id,
      event: parseDatasetEvent({
        ...eventBase(last.event.at),
        type: "aggregates-invalidated",
        scopes: AGGREGATE_SCOPES.filter((scope) => scopes.has(scope)),
      }),
    });
  }

  if (ids.size > 0) {
    emitted.push({
      id: last.id,
      event: parseDatasetEvent({
        ...eventBase(last.event.at),
        type: "findings-changed",
        ids: [...ids],
      }),
    });
  }
  return emitted;
}

export function coalesceStreamBatch(
  entries: readonly ValidatedStreamEntry[],
): ValidatedStreamEntry[] {
  const changeCount = entries.filter(({ event }) => isCoalescible(event)).length;
  if (changeCount <= DATASET_EVENTS_COALESCE_THRESHOLD) return [...entries];

  const emitted: ValidatedStreamEntry[] = [];
  let run: ValidatedStreamEntry[] = [];
  const flushRun = () => {
    if (run.length > 0) emitted.push(...coalesceRun(run));
    run = [];
  };

  for (const entry of entries) {
    if (isCoalescible(entry.event)) {
      run.push(entry);
    } else {
      flushRun();
      emitted.push(entry);
    }
  }
  flushRun();
  return emitted;
}

export async function collectStreamWindow(
  redis: Redis,
  initial: readonly ValidatedStreamEntry[],
): Promise<ValidatedStreamEntry[]> {
  const entries = [...initial];
  if (DATASET_EVENTS_COALESCE_WINDOW_MS === 0) return entries;

  const deadline = Date.now() + DATASET_EVENTS_COALESCE_WINDOW_MS;
  let cursor = entries.at(-1)?.id;
  while (cursor !== undefined) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const next = await readStreamEntries(redis, cursor, remaining);
    if (next.length === 0) break;
    entries.push(...next);
    cursor = next.at(-1)?.id;
  }
  return entries;
}

export function createResyncRequiredEvent(): DatasetEvent {
  return parseDatasetEvent({
    ...eventBase(new Date().toISOString()),
    type: "resync-required",
  });
}
