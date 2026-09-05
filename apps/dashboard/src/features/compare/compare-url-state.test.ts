/// <reference types="jest" />

import { compareStateToSearch, parseCompareSearch } from "./compare-url-state";

describe("compare URL state", () => {
  it("defaults to Analysis versus AI Analysis and waits for Compare", () => {
    const state = parseCompareSearch(new URLSearchParams());
    expect(state.left).toBe("analysis");
    expect(state.right).toBe("aiAnalysis");
    expect(state.compared).toBe(false);
  });

  it("round-trips compared sides without explore cursor state", () => {
    const search = compareStateToSearch({
      search: "",
      filters: { severity: ["critical"] },
      timeRange: { preset: "7d" },
      left: "all",
      right: "analysis",
      compared: true,
    });
    const params = new URLSearchParams(search);

    expect(params.get("left")).toBe("all");
    expect(params.get("right")).toBe("analysis");
    expect(params.get("compared")).toBe("1");
    expect(params.get("range")).toBe("7d");
    expect(params.get("severity")).toBe("critical");
    expect(params.get("mode")).toBeNull();
    expect(params.get("after")).toBeNull();
    expect(parseCompareSearch(params)).toMatchObject({
      left: "all",
      right: "analysis",
      compared: true,
      timeRange: { preset: "7d" },
    });
  });
});
