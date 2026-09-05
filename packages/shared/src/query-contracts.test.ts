/// <reference types="jest" />

import {
  AI_ANALYSIS_EXCLUDED_KAI_STATUS,
  ANALYSIS_EXCLUDED_KAI_STATUS,
  DETAIL_FIELDS,
  EXPLORE_FIELDS,
  excludedKaiStatus,
  FILTER_FIELDS,
  FINDING_FIELD_GROUPS,
  FINDING_FIELD_NAMES,
  FINDING_FIELDS,
  fieldsIn,
  isFindingField,
  matchesAnalysisMode,
  parseFindingFilters,
  parseFindingSort,
  SEARCH_FIELDS,
  SORT_FIELDS,
  selectionSet,
} from "./index.js";

describe("analysis modes", () => {
  it("uses exact and distinct kaiStatus exclusions", () => {
    expect(excludedKaiStatus("all")).toBeNull();
    expect(excludedKaiStatus("analysis")).toBe(ANALYSIS_EXCLUDED_KAI_STATUS);
    expect(excludedKaiStatus("aiAnalysis")).toBe(AI_ANALYSIS_EXCLUDED_KAI_STATUS);

    expect(matchesAnalysisMode(null, "analysis")).toBe(true);
    expect(matchesAnalysisMode(ANALYSIS_EXCLUDED_KAI_STATUS, "analysis")).toBe(false);
    expect(matchesAnalysisMode(` ${ANALYSIS_EXCLUDED_KAI_STATUS}`, "analysis")).toBe(true);
    expect(matchesAnalysisMode(ANALYSIS_EXCLUDED_KAI_STATUS.toUpperCase(), "analysis")).toBe(true);
    expect(matchesAnalysisMode(AI_ANALYSIS_EXCLUDED_KAI_STATUS, "analysis")).toBe(true);
    expect(matchesAnalysisMode(AI_ANALYSIS_EXCLUDED_KAI_STATUS, "aiAnalysis")).toBe(false);
  });
});

describe("finding field registry", () => {
  it("derives every group and registry membership from one field vocabulary", () => {
    expect(fieldsIn("explore")).toBe(EXPLORE_FIELDS);
    expect(fieldsIn("detail")).toBe(DETAIL_FIELDS);
    expect(fieldsIn("filterable")).toBe(FILTER_FIELDS);
    expect(fieldsIn("sortable")).toBe(SORT_FIELDS);
    expect(fieldsIn("searchable")).toBe(SEARCH_FIELDS);
    expect(FINDING_FIELD_GROUPS.detail).toEqual(FINDING_FIELD_NAMES);
    expect(FINDING_FIELDS.map(({ name }) => name)).toEqual(FINDING_FIELD_NAMES);
    expect(selectionSet("searchable")).toBe(SEARCH_FIELDS.join(" "));

    for (const field of FINDING_FIELDS) {
      expect(isFindingField(field.name)).toBe(true);
      for (const group of field.groups) {
        expect(FINDING_FIELD_GROUPS[group]).toContain(field.name);
      }
    }
    expect(isFindingField("DROP TABLE findings")).toBe(false);
  });

  it("accepts only bounded allowlisted filters and sorts", () => {
    expect(parseFindingFilters({ severity: ["critical"], riskFactors: ["reachable"] })).toEqual({
      severity: ["critical"],
      riskFactors: ["reachable"],
    });
    expect(parseFindingSort({ field: "publishedAt", direction: "desc" })).toEqual({
      field: "publishedAt",
      direction: "desc",
    });

    expect(() => parseFindingFilters({ findingId: ["not-filterable"] })).toThrow();
    expect(() =>
      parseFindingFilters({ severity: Array.from({ length: 51 }, () => "high") }),
    ).toThrow();
    expect(() => parseFindingFilters({ severity: ["x".repeat(257)] })).toThrow();
    expect(() => parseFindingSort({ field: "isDeleted", direction: "asc" })).toThrow();
    expect(() => parseFindingSort({ field: "cvss", direction: "sideways" })).toThrow();
  });
});
