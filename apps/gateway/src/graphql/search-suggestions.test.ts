import { rankSearchSuggestions } from "./search-suggestions.js";

describe("rankSearchSuggestions", () => {
  it("keeps the requested bound and prefers one of each searchable field", () => {
    const ranked = rankSearchSuggestions(
      [
        { field: "cve", value: "CVE-2024-1" },
        { field: "cve", value: "CVE-2024-2" },
        { field: "cve", value: "CVE-2024-3" },
        { field: "packageName", value: "nginx" },
        { field: "packageName", value: "openssl" },
        { field: "image", value: "library/nginx" },
        { field: "repo", value: "acme/api" },
      ],
      4,
    );

    expect(ranked).toEqual([
      { field: "CVE", value: "CVE-2024-1" },
      { field: "PACKAGE_NAME", value: "nginx" },
      { field: "IMAGE", value: "library/nginx" },
      { field: "REPO", value: "acme/api" },
    ]);
  });

  it("fills leftover slots from remaining matches in field order", () => {
    const ranked = rankSearchSuggestions(
      [
        { field: "cve", value: "CVE-2024-1" },
        { field: "cve", value: "CVE-2024-2" },
        { field: "cve", value: "CVE-2024-3" },
        { field: "packageName", value: "nginx" },
      ],
      4,
    );

    expect(ranked).toEqual([
      { field: "CVE", value: "CVE-2024-1" },
      { field: "PACKAGE_NAME", value: "nginx" },
      { field: "CVE", value: "CVE-2024-2" },
      { field: "CVE", value: "CVE-2024-3" },
    ]);
  });

  it("deduplicates the same value within one field", () => {
    expect(
      rankSearchSuggestions(
        [
          { field: "repo", value: "acme/api" },
          { field: "repo", value: "acme/api" },
          { field: "image", value: "acme/api" },
        ],
        10,
      ),
    ).toEqual([
      { field: "IMAGE", value: "acme/api" },
      { field: "REPO", value: "acme/api" },
    ]);
  });
});
