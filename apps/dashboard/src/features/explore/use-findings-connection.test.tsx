/// <reference types="jest" />

import { MockedProvider } from "@apollo/client/testing/react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { DEFAULT_EXPLORE_URL_STATE } from "../../app/url-state";
import { createDashboardCache, FINDINGS_CACHE_EDGE_CAP } from "../../graphql/cache";
import { ExploreFindingsDocument } from "../../graphql/operations";
import { useFindingsConnection } from "./use-findings-connection";

const PAGE_SIZE = 50;
const TOTAL_COUNT = 236_653;
const PAGES_PAST_CACHE_CAP = FINDINGS_CACHE_EDGE_CAP / PAGE_SIZE + 1;

function edge(index: number) {
  return {
    __typename: "FindingEdge",
    cursor: `c${index}`,
    node: {
      __typename: "FindingRow",
      id: index.toString(16).padStart(32, "0"),
      cve: `CVE-2026-${index.toString().padStart(4, "0")}`,
      severity: "high",
      cvss: 7.5,
      status: "open",
      packageName: "pkg",
      packageVersion: "1.0.0",
      repo: "repo",
      image: "img",
      publishedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function page(start: number, first: number) {
  const edges = Array.from({ length: first }, (_, index) => edge(start + index));
  return {
    __typename: "FindingConnection",
    edges,
    pageInfo: {
      __typename: "PageInfo",
      endCursor: `c${start + first - 1}`,
      hasNextPage: true,
    },
    totalCount: TOTAL_COUNT,
  };
}

function pageMock(after: string | undefined, start: number) {
  return {
    request: {
      query: ExploreFindingsDocument,
      variables: (vars: { after?: string | null; first?: number | null }) =>
        vars.first === PAGE_SIZE && (after == null ? vars.after == null : vars.after === after),
    },
    result: { data: { findings: page(start, PAGE_SIZE) } },
    maxUsageCount: 1,
  };
}

function renderConnection() {
  const mocks = Array.from({ length: PAGES_PAST_CACHE_CAP }, (_, pageIndex) =>
    pageMock(pageIndex === 0 ? undefined : `c${pageIndex * PAGE_SIZE - 1}`, pageIndex * PAGE_SIZE),
  );
  return renderHook(() => useFindingsConnection(DEFAULT_EXPLORE_URL_STATE, PAGE_SIZE), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MockedProvider
        mocks={mocks}
        cache={createDashboardCache()}
        mockLinkDefaultOptions={{ delay: 0 }}
      >
        {children}
      </MockedProvider>
    ),
  });
}

describe("useFindingsConnection loaded count", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps advancing past the 600-edge cache window after fetchMore", async () => {
    const { result } = renderConnection();

    await waitFor(() => {
      expect(result.current.data?.findings.edges).toHaveLength(PAGE_SIZE);
    });
    expect(result.current.loadedCount).toBe(PAGE_SIZE);

    for (let pageIndex = 1; pageIndex < PAGES_PAST_CACHE_CAP; pageIndex += 1) {
      const expectedLoaded = (pageIndex + 1) * PAGE_SIZE;
      const expectedWindow = Math.min(expectedLoaded, FINDINGS_CACHE_EDGE_CAP);
      await act(async () => {
        await result.current.loadMore();
      });
      await waitFor(() => {
        expect(result.current.loadedCount).toBe(expectedLoaded);
        expect(result.current.data?.findings.edges).toHaveLength(expectedWindow);
      });
    }

    expect(result.current.loadedCount).toBeGreaterThan(FINDINGS_CACHE_EDGE_CAP);
  });
});
