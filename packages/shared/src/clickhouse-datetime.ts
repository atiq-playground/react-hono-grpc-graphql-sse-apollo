/**
 * ClickHouse DateTime / DateTime64 wire text helpers.
 * Pure encode/decode only — no SQL, no client, no Node APIs.
 */

/** Encode to `YYYY-MM-DD HH:mm:ss.sss` (UTC, no trailing `Z`). */
export function formatClickHouseDateTime(date: Date | number): string {
  const instant = typeof date === "number" ? new Date(date) : date;
  return instant.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Normalize ClickHouse DateTime text for `Date.parse`.
 * Accepts space-separated or `T`-separated forms; appends `Z` when no zone
 * suffix (`Z` or `±HH:MM`) is present.
 */
function normalizeClickHouseDateTime(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return /(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : `${normalized}Z`;
}

/** Parse ClickHouse DateTime wire text into a Date. */
export function parseClickHouseDateTime(value: string): Date {
  const epoch = Date.parse(normalizeClickHouseDateTime(value));
  if (!Number.isFinite(epoch)) {
    throw new Error(`Invalid ClickHouse DateTime: ${value}`);
  }
  return new Date(epoch);
}

/** Normalize ClickHouse DateTime text (rejecting non-strings) to ISO-8601. */
export function isoFromClickHouseDateTime(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected ClickHouse DateTime string");
  }
  return parseClickHouseDateTime(value).toISOString();
}

/** Like {@link isoFromClickHouseDateTime}, but `null` / `undefined` → `null`. */
export function nullableIsoFromClickHouseDateTime(value: unknown): string | null {
  return value === null || value === undefined ? null : isoFromClickHouseDateTime(value);
}
