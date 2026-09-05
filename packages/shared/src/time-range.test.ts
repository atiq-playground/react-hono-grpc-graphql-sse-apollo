/// <reference types="jest" />

import { parseTimeRangeInput, resolveTimeRange, toInterval } from "./index.js";

const NOW = new Date("2026-09-05T23:45:12.345Z");

describe("time ranges", () => {
  it.each([
    ["24h", "2026-09-04T23:45:12.345Z"],
    ["7d", "2026-08-29T23:45:12.345Z"],
    ["30d", "2026-08-06T23:45:12.345Z"],
    ["1y", "2025-09-05T23:45:12.345Z"],
    ["5y", "2021-09-05T23:45:12.345Z"],
  ] as const)("resolves %s using UTC calendar arithmetic", (preset, expectedFrom) => {
    const interval = toInterval(preset, NOW);

    expect(interval.from?.toISOString()).toBe(expectedFrom);
    expect(interval.to?.toISOString()).toBe(NOW.toISOString());
    expect(interval.to).not.toBe(NOW);
  });

  it("keeps Live unbounded", () => {
    expect(toInterval("live", NOW)).toEqual({ from: null, to: null });
  });

  it("preserves validated custom instants", () => {
    const input = parseTimeRangeInput({
      preset: "custom",
      from: "2026-09-01T00:00:00-04:00",
      to: "2026-09-02T23:59:59-04:00",
    });

    const interval = resolveTimeRange(input, NOW);
    expect(interval.from?.toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(interval.to?.toISOString()).toBe("2026-09-03T03:59:59.000Z");
  });

  it.each([
    { preset: "custom" },
    { preset: "custom", from: NOW.toISOString() },
    {
      preset: "custom",
      from: "2026-09-06T00:00:00.000Z",
      to: "2026-09-05T00:00:00.000Z",
    },
    { preset: "24h", from: "2026-09-05T00:00:00.000Z" },
    { preset: "custom", from: "not-iso", to: NOW.toISOString() },
  ])("rejects invalid custom or preset bounds: %p", (value) => {
    expect(() => parseTimeRangeInput(value)).toThrow();
  });
});
