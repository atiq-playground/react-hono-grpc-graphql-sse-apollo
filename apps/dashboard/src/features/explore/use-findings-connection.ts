import { NetworkStatus } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";

import type { ExploreUrlState } from "../../app/url-state";
import { ExploreFindingsDocument } from "../../graphql/operations";
import { toExploreFindingsVariables } from "../../graphql/variables";
import {
  displayedLoadedCount,
  EMPTY_LOADED_FINDING_COUNT,
  loadedCountAfterFetchMore,
  loadedCountAfterReplace,
} from "./loaded-finding-count";

export const DEFAULT_FINDINGS_PAGE_SIZE = 50;
export const MAX_FINDINGS_PAGE_SIZE = 100;

export function useFindingsConnection(state: ExploreUrlState, first = DEFAULT_FINDINGS_PAGE_SIZE) {
  const requestedPageSize = Number.isFinite(first) ? Math.trunc(first) : DEFAULT_FINDINGS_PAGE_SIZE;
  const pageSize = Math.min(MAX_FINDINGS_PAGE_SIZE, Math.max(1, requestedPageSize));
  const isFetchingRef = useRef(false);
  const lastRequestedCursorRef = useRef<string | null>(null);
  const activePartitionRef = useRef<string | null>(null);
  const previousNetworkStatusRef = useRef<NetworkStatus>(NetworkStatus.loading);
  const [loadMoreFailure, setLoadMoreFailure] = useState<{
    partitionKey: string;
    message: string;
  } | null>(null);
  const [loadedCountState, setLoadedCountState] = useState(EMPTY_LOADED_FINDING_COUNT);
  const variables = toExploreFindingsVariables(state, pageSize);
  const partitionKey = JSON.stringify({ ...variables, after: null });
  const query = useQuery(ExploreFindingsDocument, {
    variables,
    notifyOnNetworkStatusChange: true,
  });
  const displayedCount = query.data?.findings.edges.length ?? 0;

  if (query.data && loadedCountState.partitionKey !== partitionKey) {
    setLoadedCountState(loadedCountAfterReplace(partitionKey, displayedCount));
  }

  useEffect(() => {
    const previous = previousNetworkStatusRef.current;
    previousNetworkStatusRef.current = query.networkStatus;
    if (!query.data || query.networkStatus !== NetworkStatus.ready) return;
    const wasFirstPageFetch =
      previous === NetworkStatus.loading ||
      previous === NetworkStatus.refetch ||
      previous === NetworkStatus.setVariables;
    if (!wasFirstPageFetch) return;
    setLoadedCountState(loadedCountAfterReplace(partitionKey, query.data.findings.edges.length));
  }, [partitionKey, query.data, query.networkStatus]);

  const loadMore = async (): Promise<void> => {
    if (activePartitionRef.current !== partitionKey) {
      activePartitionRef.current = partitionKey;
      isFetchingRef.current = false;
      lastRequestedCursorRef.current = null;
    }

    const pageInfo = query.data?.findings.pageInfo;
    const cursor = pageInfo?.endCursor;
    if (
      !pageInfo?.hasNextPage ||
      !cursor ||
      isFetchingRef.current ||
      lastRequestedCursorRef.current === cursor
    ) {
      return;
    }

    isFetchingRef.current = true;
    lastRequestedCursorRef.current = cursor;
    setLoadMoreFailure(null);
    try {
      const result = await query.fetchMore({ variables: { after: cursor, first: pageSize } });
      const incomingCount = result.data?.findings.edges.length ?? 0;
      setLoadedCountState((state) => loadedCountAfterFetchMore(state, partitionKey, incomingCount));
    } catch (error: unknown) {
      lastRequestedCursorRef.current = null;
      setLoadMoreFailure({
        partitionKey,
        message: "The next bounded page could not be loaded",
      });
      throw error;
    } finally {
      isFetchingRef.current = false;
    }
  };

  return {
    ...query,
    pageSize,
    loadMore,
    loadedCount: displayedLoadedCount(loadedCountState, partitionKey, displayedCount),
    loadMoreError: loadMoreFailure?.partitionKey === partitionKey ? loadMoreFailure.message : null,
    hasNextPage: query.data?.findings.pageInfo.hasNextPage ?? false,
    isFetchingMore: query.networkStatus === NetworkStatus.fetchMore,
  };
}
