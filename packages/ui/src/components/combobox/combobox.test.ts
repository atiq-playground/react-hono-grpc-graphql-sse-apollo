/// <reference types="jest" />

import {
  COMBOBOX_SEARCH_THRESHOLD,
  isComboboxSearchable,
  matchesComboboxItem,
} from "./combobox-search";

describe("isComboboxSearchable", () => {
  it("auto-enables only when the list is longer than 10", () => {
    expect(isComboboxSearchable(COMBOBOX_SEARCH_THRESHOLD)).toBe(false);
    expect(isComboboxSearchable(COMBOBOX_SEARCH_THRESHOLD + 1)).toBe(true);
  });

  it("honors an explicit searchable toggle", () => {
    expect(isComboboxSearchable(3, true)).toBe(true);
    expect(isComboboxSearchable(20, false)).toBe(false);
  });
});

describe("matchesComboboxItem", () => {
  it("matches loaded label or value text", () => {
    const item = { value: "repo:acme/api", label: "acme/api", textValue: "acme/api" };
    expect(matchesComboboxItem(item, "")).toBe(true);
    expect(matchesComboboxItem(item, "ACME")).toBe(true);
    expect(matchesComboboxItem(item, "repo:acme")).toBe(true);
    expect(matchesComboboxItem(item, "missing")).toBe(false);
  });
});
