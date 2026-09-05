/// <reference types="jest" />

import type { ExportQueryInput } from "../findings-query.types.js";
import {
  exportArtifactName,
  exportAttachmentFilename,
  resolveExportArtifactPath,
  resolveExportTemporaryPath,
} from "./artifact.js";
import { buildExportStatement } from "./export-query.js";
import { exportDownloadUrl, parseExportJobId } from "./job-store.js";

const JOB_ID = "123e4567-e89b-42d3-a456-426614174000";

const input: ExportQueryInput = {
  filters: { severity: ["=cmd|' /C calc'!A0"] },
  timeRange: { from: null, to: null },
  analysisMode: "aiAnalysis",
  search: "@SUM(1+1)",
  sort: { field: "cvss", direction: "desc" },
};

describe("export query safety", () => {
  it("formula-neutralizes every textual field while leaving CSV quoting to ClickHouse", () => {
    const statement = buildExportStatement(input);

    expect(statement.query).toContain("FORMAT CSVWithNames");
    expect(statement.query).toContain("match(");
    expect(statement.query).toContain("concat({export_formula_escape:String}");
    expect(statement.queryParams).toMatchObject({
      export_formula_prefix: "^[=+\\-@\t\r]",
      export_formula_escape: "'",
      export_filter_values_0: ["=cmd|' /C calc'!A0"],
      export_search: "@SUM(1+1)",
    });
    expect(statement.query).not.toContain("=cmd|' /C calc'!A0");
    expect(statement.query).not.toContain("@SUM(1+1)");

    const identifiers = Object.entries(statement.queryParams)
      .filter(([name]) => name.startsWith("export_field_"))
      .map(([, value]) => value);
    expect(identifiers).toContain("findingId");
    expect(identifiers).toContain("cve");
    expect(identifiers).not.toContain("description");
  });
});

describe("export identifiers and artifact confinement", () => {
  it("derives confined names and URLs from a validated UUID", () => {
    expect(parseExportJobId(JOB_ID)).toBe(JOB_ID);
    expect(exportArtifactName(JOB_ID)).toBe(`${JOB_ID}.csv`);
    expect(exportAttachmentFilename(JOB_ID)).toBe(`findings-export-${JOB_ID}.csv`);
    expect(exportDownloadUrl(JOB_ID)).toBe(`/api/exports/${JOB_ID}`);
    expect(resolveExportArtifactPath(JOB_ID, `${JOB_ID}.csv`)).toMatch(
      new RegExp(`${JOB_ID}\\.csv$`),
    );
    expect(resolveExportTemporaryPath(JOB_ID)).toMatch(new RegExp(`${JOB_ID}\\.csv\\.part$`));
  });

  it.each([
    "",
    "../123e4567-e89b-42d3-a456-426614174000",
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-42d3-c456-426614174000",
    `${JOB_ID}.csv`,
  ])("rejects invalid export job id %p", (id) => {
    expect(() => parseExportJobId(id)).toThrow();
  });

  it.each([`../${JOB_ID}.csv`, `${JOB_ID}.csv/other`, "different.csv", `${JOB_ID}.csv.part`])(
    "rejects mismatched or escaping artifact metadata %p",
    (artifactName) => {
      expect(() => resolveExportArtifactPath(JOB_ID, artifactName)).toThrow(
        "Invalid export artifact metadata",
      );
    },
  );
});
