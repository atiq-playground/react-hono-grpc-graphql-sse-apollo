/// <reference types="jest" />

import type { FindingSort } from "@repo/shared";
import { encodeCursor } from "./cursor.js";
import type { FindingsQueryInput } from "./findings-query.types.js";
import { parseFindingsArgs } from "./input.js";
import { compileKeyset, compileOrderBy, compileWhere } from "./query-compiler.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const ID = "0123456789abcdef0123456789abcdef";

function input(overrides: Partial<FindingsQueryInput> = {}): FindingsQueryInput {
  return {
    filters: {},
    timeRange: { from: null, to: null },
    analysisMode: "all",
    search: null,
    sort: { field: "cvss", direction: "desc" },
    after: null,
    first: 50,
    ...overrides,
  };
}

describe("findings query compiler", () => {
  it("parameterizes filters, search, time bounds, and exact analysis semantics", () => {
    const untrustedFilter = "critical') OR 1=1 --";
    const untrustedSearch = "CVE%') UNION ALL SELECT * --";
    const compiled = compileWhere(
      input({
        filters: { severity: [untrustedFilter], riskFactors: ["reachable"] },
        timeRange: {
          from: new Date("2026-09-01T00:00:00.000Z"),
          to: new Date("2026-09-05T23:59:59.999Z"),
        },
        analysisMode: "analysis",
        search: untrustedSearch,
      }),
      { prefix: "qa" },
    );

    expect(compiled.sql).toContain("{qa_filter_column_0:Identifier}");
    expect(compiled.sql).toContain("{qa_filter_values_0:Array(String)}");
    expect(compiled.sql).toContain("hasAny({qa_filter_column_1:Identifier}");
    expect(compiled.sql).toContain("{qa_excluded_kai_status:String}");
    expect(compiled.sql).toContain("{qa_published_from:DateTime64(3)}");
    expect(compiled.sql).toContain("{qa_published_to:DateTime64(3)}");
    expect(compiled.sql).toContain("{qa_search:String}");
    expect(compiled.sql).not.toContain(untrustedFilter);
    expect(compiled.sql).not.toContain(untrustedSearch);
    expect(compiled.params).toMatchObject({
      qa_active: 0,
      qa_filter_column_0: "severity",
      qa_filter_values_0: [untrustedFilter],
      qa_filter_column_1: "riskFactors",
      qa_filter_values_1: ["reachable"],
      qa_excluded_kai_status: "invalid - norisk",
      qa_published_from: "2026-09-01 00:00:00.000",
      qa_published_to: "2026-09-05 23:59:59.999",
      qa_search: untrustedSearch,
    });
  });

  it("excludes one facet filter without changing other predicates", () => {
    const compiled = compileWhere(input({ filters: { severity: ["high"], status: ["open"] } }), {
      prefix: "facet",
      excludeFilter: "severity",
    });

    expect(Object.values(compiled.params)).not.toContain("severity");
    expect(compiled.params).toMatchObject({
      facet_filter_column_0: "status",
      facet_filter_values_0: ["open"],
    });
  });

  it.each(["isDeleted", "findingId", "severity); DROP TABLE findings"] as const)(
    "rejects non-allowlisted filter identifier %s at input validation",
    (field) => {
      expect(() => parseFindingsArgs({ filters: { [field]: ["x"] } }, NOW)).toThrow(
        "Invalid findings arguments",
      );
    },
  );

  it("builds stable null-last ordering and nullable keyset predicates", () => {
    const sort: FindingSort = { field: "publishedAt", direction: "desc" };
    const order = compileOrderBy(sort, "page");
    const afterNonNull = compileKeyset(
      input({
        sort,
        after: encodeCursor({ s: "2026-09-05 12:00:00", id: ID }),
      }),
      "page",
    );
    const afterNull = compileKeyset(
      input({ sort, after: encodeCursor({ s: null, id: ID }) }),
      "page",
    );

    expect(order.sql).toBe(
      "isNull({page_sort_column:Identifier}) ASC, {page_sort_column:Identifier} DESC, findingId ASC",
    );
    expect(order.params).toEqual({ page_sort_column: "publishedAt" });
    expect(afterNonNull?.sql).toContain("isNull({page_sort_column:Identifier}) = 0");
    expect(afterNonNull?.sql).toContain("{page_sort_column:Identifier} <");
    expect(afterNonNull?.sql).toContain("OR isNull({page_sort_column:Identifier}) = 1");
    expect(afterNull).toEqual({
      sql: "isNull({page_sort_column:Identifier}) AND findingId > {page_cursor_id:String}",
      params: { page_sort_column: "publishedAt", page_cursor_id: ID },
    });
  });

  it("clamps first and rejects zero, fractions, and invalid custom ranges", () => {
    expect(parseFindingsArgs({ first: 10_000 }, NOW).first).toBe(200);
    expect(parseFindingsArgs({}, NOW).first).toBe(50);
    expect(() => parseFindingsArgs({ first: 0 }, NOW)).toThrow("Invalid findings arguments");
    expect(() => parseFindingsArgs({ first: 1.5 }, NOW)).toThrow("Invalid findings arguments");
    expect(() =>
      parseFindingsArgs(
        {
          timeRange: {
            preset: "CUSTOM",
            from: "2026-09-06T00:00:00.000Z",
            to: "2026-09-05T00:00:00.000Z",
          },
        },
        NOW,
      ),
    ).toThrow("Invalid findings arguments");
  });
});
