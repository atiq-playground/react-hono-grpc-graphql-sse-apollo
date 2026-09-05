/// <reference types="jest" />

import {
  DATASET_EVENT_MAX_CHANGED_IDS,
  DATASET_EVENT_TYPES,
  type DatasetEvent,
  decodeDatasetEvent,
  encodeDatasetEvent,
  parseDatasetEvent,
} from "./index.js";

const finding = {
  id: "0123456789abcdef0123456789abcdef",
  cve: "CVE-2026-0001",
  severity: "high",
  cvss: 8.2,
  status: "open",
  packageName: "safe-package",
  packageVersion: "1.0.0",
  group: "platform",
  repo: "dashboard",
  image: "registry.example/dashboard:1",
  kaiStatus: null,
  publishedAt: "2026-09-05T12:00:00.000Z",
} as const;

const base = {
  v: 1 as const,
  datasetVersion: "qa-1",
  at: "2026-09-05T12:30:00.000Z",
};

const events: readonly DatasetEvent[] = [
  { ...base, type: "finding-upserted", finding },
  { ...base, type: "finding-deleted", id: finding.id },
  { ...base, type: "findings-changed", ids: [finding.id] },
  { ...base, type: "aggregates-invalidated", scopes: ["overview", "facets", "findings"] },
  { ...base, type: "dataset-version-changed" },
  { ...base, type: "export-ready", jobId: "123e4567-e89b-42d3-a456-426614174000" },
  { ...base, type: "resync-required" },
];

describe("DatasetEvent contract", () => {
  it("round trips every declared event variant through the JSON codec", () => {
    expect(events.map(({ type }) => type)).toEqual(DATASET_EVENT_TYPES);

    for (const event of events) {
      expect(decodeDatasetEvent(encodeDatasetEvent(event))).toEqual(event);
    }
  });

  it.each([
    ["unknown type", { ...base, type: "finding-block", payload: "not-allowed" }],
    ["wrong version", { ...base, v: 2, type: "resync-required" }],
    ["missing dataset version", { v: 1, at: base.at, type: "resync-required" }],
    ["empty dataset version", { ...base, datasetVersion: "", type: "resync-required" }],
    ["malformed timestamp", { ...base, at: "today", type: "resync-required" }],
    ["empty changed ids", { ...base, type: "findings-changed", ids: [] }],
    [
      "too many changed ids",
      {
        ...base,
        type: "findings-changed",
        ids: Array.from({ length: DATASET_EVENT_MAX_CHANGED_IDS + 1 }, () => finding.id),
      },
    ],
    ["unknown aggregate scope", { ...base, type: "aggregates-invalidated", scopes: ["corpus"] }],
    ["invalid finding id", { ...base, type: "finding-deleted", id: "" }],
  ])("rejects %s", (_label, value) => {
    expect(() => parseDatasetEvent(value)).toThrow();
  });

  it("rejects malformed JSON before schema validation", () => {
    expect(() => decodeDatasetEvent("{")).toThrow("Invalid DatasetEvent payload");
  });
});
