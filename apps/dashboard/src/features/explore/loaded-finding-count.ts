/**
 * Tracks how many Finding rows the current Explore partition has fetched.
 * The Apollo cache may drop older pages at FINDINGS_CACHE_EDGE_CAP; this
 * count is the fetch high-water mark, not a full-corpus client index.
 */

export type LoadedFindingCountState = {
  readonly partitionKey: string;
  readonly count: number;
};

export const EMPTY_LOADED_FINDING_COUNT: LoadedFindingCountState = {
  partitionKey: "",
  count: 0,
};

/** First-page load, partition change, or refetch that replaces the window. */
export function loadedCountAfterReplace(
  partitionKey: string,
  displayedCount: number,
): LoadedFindingCountState {
  return { partitionKey, count: Math.max(0, displayedCount) };
}

/** Successful `fetchMore` of one bounded cursor page. */
export function loadedCountAfterFetchMore(
  state: LoadedFindingCountState,
  partitionKey: string,
  incomingCount: number,
): LoadedFindingCountState {
  const added = Math.max(0, incomingCount);
  if (state.partitionKey !== partitionKey) {
    return { partitionKey, count: added };
  }
  return { partitionKey, count: state.count + added };
}

/** Prefer the fetch high-water mark; fall back to the visible cache window. */
export function displayedLoadedCount(
  state: LoadedFindingCountState,
  partitionKey: string,
  displayedCount: number,
): number {
  if (state.partitionKey !== partitionKey) return Math.max(0, displayedCount);
  return Math.max(state.count, displayedCount);
}
