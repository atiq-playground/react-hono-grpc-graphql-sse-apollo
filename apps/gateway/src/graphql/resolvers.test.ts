import type { ClickHouseClient } from "@clickhouse/client";
import { queryFacet } from "./resolvers";

function mockClickHouse(rows: Array<{ value: string; count: string }>) {
  const calls: unknown[] = [];
  const query = async (parameters: unknown) => {
    calls.push(parameters);
    return {
      json: async () => rows,
    };
  };

  return {
    ch: { query } as unknown as ClickHouseClient,
    calls,
  };
}

describe("queryFacet", () => {
  it("binds reserved column names as ClickHouse identifiers", async () => {
    const { ch, calls } = mockClickHouse([{ value: "platform", count: "2" }]);

    await expect(queryFacet(ch, "group")).resolves.toEqual([{ value: "platform", count: 2 }]);
    expect(calls).toEqual([
      {
        query: expect.stringContaining("toString({column:Identifier})"),
        query_params: { column: "group" },
        format: "JSONEachRow",
      },
    ]);
  });

  it("rejects columns outside the facet allowlist before querying", async () => {
    const { ch, calls } = mockClickHouse([]);

    await expect(queryFacet(ch, "description")).rejects.toMatchObject({
      message: "Invalid facet column",
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects SQL fragments before querying", async () => {
    const { ch, calls } = mockClickHouse([]);

    await expect(queryFacet(ch, "severity) FROM findings; DROP TABLE findings")).rejects.toThrow(
      "Invalid facet column",
    );
    expect(calls).toHaveLength(0);
  });
});
