/// <reference types="jest" />

import { gql } from "@apollo/client";
import { createDashboardCache, FINDINGS_CACHE_EDGE_CAP } from "./cache";

const FINDINGS_QUERY = gql`
  query CacheFindings(
    $filters: FindingFiltersInput
    $sort: FindingSortInput
    $search: String
    $timeRange: TimeRangeInput
    $analysisMode: AnalysisMode
    $after: String
  ) {
    findings(
      filters: $filters
      sort: $sort
      search: $search
      timeRange: $timeRange
      analysisMode: $analysisMode
      after: $after
    ) {
      edges {
        cursor
        node {
          id
          cve
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
      totalCount
    }
  }
`;

const partition = {
  filters: { severity: ["high"] },
  sort: { field: "CVSS", direction: "DESC" },
  search: "",
  timeRange: { preset: "LIVE" },
  analysisMode: "ALL",
};

function edge(index: number, cursor = `cursor-${index}`) {
  return {
    __typename: "FindingEdge",
    cursor,
    node: {
      __typename: "FindingRow",
      id: index.toString(16).padStart(32, "0"),
      cve: `CVE-2026-${index.toString().padStart(4, "0")}`,
    },
  };
}

function page(indices: readonly number[]) {
  return {
    __typename: "FindingConnection",
    edges: indices.map((index) => edge(index)),
    pageInfo: {
      __typename: "PageInfo",
      endCursor: indices.length === 0 ? null : `cursor-${indices.at(-1)}`,
      hasNextPage: true,
    },
    totalCount: 236_653,
  };
}

function writePage(
  cache: ReturnType<typeof createDashboardCache>,
  after: string | null,
  indices: readonly number[],
): void {
  cache.writeQuery({
    query: FINDINGS_QUERY,
    variables: { ...partition, after },
    data: { findings: page(indices) },
  });
}

describe("findings Apollo field policy", () => {
  it("merges cursor pages without duplicate ids or cursors", () => {
    const cache = createDashboardCache();
    writePage(cache, null, [1, 2, 3]);

    cache.writeQuery({
      query: FINDINGS_QUERY,
      variables: { ...partition, after: "cursor-3" },
      data: {
        findings: {
          ...page([3, 4, 5]),
          edges: [edge(3), edge(4), edge(40, "cursor-4"), edge(5)],
        },
      },
    });

    const result = cache.readQuery<{ findings: { edges: ReturnType<typeof edge>[] } }>({
      query: FINDINGS_QUERY,
      variables: { ...partition, after: "cursor-3" },
    });
    expect(result?.findings.edges.map(({ node }) => node.id)).toEqual([
      edge(1).node.id,
      edge(2).node.id,
      edge(3).node.id,
      edge(4).node.id,
      edge(5).node.id,
    ]);
  });

  it("caps one argument partition at 600 most-recent edges", () => {
    const cache = createDashboardCache();
    writePage(
      cache,
      null,
      Array.from({ length: 200 }, (_, index) => index),
    );
    for (let pageIndex = 1; pageIndex < 4; pageIndex += 1) {
      const start = pageIndex * 200;
      writePage(
        cache,
        `cursor-${start - 1}`,
        Array.from({ length: 200 }, (_, index) => start + index),
      );
    }

    const result = cache.readQuery<{ findings: { edges: ReturnType<typeof edge>[] } }>({
      query: FINDINGS_QUERY,
      variables: { ...partition, after: "cursor-599" },
    });
    expect(result?.findings.edges).toHaveLength(FINDINGS_CACHE_EDGE_CAP);
    expect(result?.findings.edges[0]?.node.id).toBe(edge(200).node.id);
    expect(result?.findings.edges.at(-1)?.node.id).toBe(edge(799).node.id);
  });

  it("isolates argument partitions and replaces on a first-page refetch", () => {
    const cache = createDashboardCache();
    writePage(cache, null, [1, 2]);
    writePage(cache, "cursor-2", [3]);

    const otherPartition = {
      ...partition,
      filters: { severity: ["critical"] },
      after: null,
    };
    cache.writeQuery({
      query: FINDINGS_QUERY,
      variables: otherPartition,
      data: { findings: page([10]) },
    });

    expect(
      cache.readQuery({ query: FINDINGS_QUERY, variables: { ...partition, after: "cursor-2" } }),
    ).toBeNull();
    const critical = cache.readQuery<{ findings: { edges: ReturnType<typeof edge>[] } }>({
      query: FINDINGS_QUERY,
      variables: otherPartition,
    });
    expect(critical?.findings.edges.map(({ node }) => node.id)).toEqual([edge(10).node.id]);

    cache.writeQuery({
      query: FINDINGS_QUERY,
      variables: otherPartition,
      data: { findings: page([11]) },
    });
    const refreshed = cache.readQuery<{ findings: { edges: ReturnType<typeof edge>[] } }>({
      query: FINDINGS_QUERY,
      variables: otherPartition,
    });
    expect(refreshed?.findings.edges.map(({ node }) => node.id)).toEqual([edge(11).node.id]);
  });
});
