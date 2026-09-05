/// <reference types="jest" />

import { formatSignedCount, mergeFacetRows } from "./compare-view";

describe("mergeFacetRows", () => {
  it("unions keys, prefers severity order, and computes right minus left", () => {
    const rows = mergeFacetRows(
      [
        { value: "high", count: 4 },
        { value: "critical", count: 2 },
      ],
      [
        { value: "critical", count: 5 },
        { value: "low", count: 1 },
      ],
      ["critical", "high", "medium", "low"],
    );

    expect(rows.map((row) => row.key)).toEqual(["critical", "high", "low"]);
    expect(rows[0]).toMatchObject({ left: 2, right: 5, delta: 3 });
    expect(rows[1]).toMatchObject({ left: 4, right: 0, delta: -4 });
  });

  it("labels blank facet values", () => {
    const [row] = mergeFacetRows([{ value: "", count: 3 }], []);
    expect(row).toMatchObject({ key: "", label: "(blank)", left: 3, right: 0 });
  });
});

describe("formatSignedCount", () => {
  it("keeps a leading sign except for zero", () => {
    expect(formatSignedCount(1200)).toBe("+1,200");
    expect(formatSignedCount(-3)).toBe("-3");
    expect(formatSignedCount(0)).toBe("0");
  });
});
