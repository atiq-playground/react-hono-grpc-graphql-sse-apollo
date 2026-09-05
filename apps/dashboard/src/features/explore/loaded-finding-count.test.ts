/// <reference types="jest" />

import {
  displayedLoadedCount,
  EMPTY_LOADED_FINDING_COUNT,
  loadedCountAfterFetchMore,
  loadedCountAfterReplace,
} from "./loaded-finding-count";

const PARTITION_A = '{"filters":null}';
const PARTITION_B = '{"filters":{"severity":["high"]}}';

describe("loaded finding count", () => {
  it("advances past the 600-edge cache window as more pages are fetched", () => {
    let state = loadedCountAfterReplace(PARTITION_A, 50);
    expect(displayedLoadedCount(state, PARTITION_A, 50)).toBe(50);

    for (let page = 0; page < 12; page += 1) {
      state = loadedCountAfterFetchMore(state, PARTITION_A, 50);
    }

    expect(state.count).toBe(650);
    expect(displayedLoadedCount(state, PARTITION_A, 600)).toBe(650);
  });

  it("resets on a first-page replace and on a partition change", () => {
    const accumulated = loadedCountAfterFetchMore(
      loadedCountAfterReplace(PARTITION_A, 50),
      PARTITION_A,
      50,
    );
    expect(accumulated.count).toBe(100);

    const replaced = loadedCountAfterReplace(PARTITION_A, 50);
    expect(displayedLoadedCount(replaced, PARTITION_A, 50)).toBe(50);

    const switched = loadedCountAfterFetchMore(accumulated, PARTITION_B, 50);
    expect(switched).toEqual({ partitionKey: PARTITION_B, count: 50 });
    expect(displayedLoadedCount(EMPTY_LOADED_FINDING_COUNT, PARTITION_B, 50)).toBe(50);
  });
});
