/**
 * Wire codec for DatasetEvents. SSE is text-only, so the shipped encoding is
 * JSON. Callers depend only on encode/decode, never on the representation.
 */
import { type DatasetEvent, parseDatasetEvent } from "./dataset-events.js";

/** Validates and serializes an event; unknown keys are stripped before the wire. */
export function encodeDatasetEvent(event: DatasetEvent): string {
  return JSON.stringify(parseDatasetEvent(event));
}

/** Parses untrusted text (SSE `data`, Redis entry field) into a validated event. */
export function decodeDatasetEvent(text: string): DatasetEvent {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "malformed JSON";
    throw new Error(`Invalid DatasetEvent payload: ${reason}`);
  }
  return parseDatasetEvent(value);
}
