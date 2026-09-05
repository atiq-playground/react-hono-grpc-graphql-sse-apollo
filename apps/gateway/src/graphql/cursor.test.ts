/// <reference types="jest" />

import type { FindingSort } from "@repo/shared";
import { decodeCursor, encodeCursor } from "./cursor.js";

const ID = "0123456789abcdef0123456789abcdef";
const CVSS_SORT: FindingSort = { field: "cvss", direction: "desc" };
const PUBLISHED_SORT: FindingSort = { field: "publishedAt", direction: "asc" };

function replacePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("opaque findings cursors", () => {
  it("round trips text, numeric, and nullable sort values", () => {
    const numeric = encodeCursor({ s: 8.7, id: ID });
    const nullable = encodeCursor({ s: null, id: ID });
    const date = encodeCursor({ s: "2026-09-05 12:30:00.123", id: ID });

    expect(decodeCursor(numeric, CVSS_SORT)).toEqual({ s: 8.7, id: ID });
    expect(decodeCursor(nullable, PUBLISHED_SORT)).toEqual({ s: null, id: ID });
    expect(decodeCursor(date, PUBLISHED_SORT)).toEqual({
      s: "2026-09-05 12:30:00.123",
      id: ID,
    });
  });

  it.each([
    ["non-base64url characters", "%%%"],
    ["invalid UTF-8", "_w"],
    ["invalid JSON", Buffer.from("{", "utf8").toString("base64url")],
    ["extra field", replacePayload({ s: 8.7, id: ID, admin: true })],
    ["altered id", replacePayload({ s: 8.7, id: `${ID.slice(0, -1)}z` })],
    ["altered numeric sort type", replacePayload({ s: "8.7", id: ID })],
    ["non-finite sort", replacePayload({ s: null, id: ID })],
    ["date sort with malformed date", replacePayload({ s: "tomorrow", id: ID })],
  ])("rejects %s", (label, cursor) => {
    const sort: FindingSort =
      label === "date sort with malformed date"
        ? PUBLISHED_SORT
        : label === "non-finite sort"
          ? { field: "severity", direction: "asc" as const }
          : CVSS_SORT;
    expect(() => decodeCursor(cursor, sort)).toThrow("Invalid findings cursor");
  });

  it("rejects overlong cursors before decoding", () => {
    expect(() => decodeCursor("a".repeat(513), CVSS_SORT)).toThrow("Invalid findings cursor");
  });
});
