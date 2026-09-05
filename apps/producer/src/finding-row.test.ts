/// <reference types="jest" />

import { fromBinary, ScalarType, toBinary } from "@bufbuild/protobuf";
import { decodeDictColumn, decodeOffsetStringArrays, FindingBlockSchema } from "@repo/proto";
import { packFindingColumns, rowsToFindingBlock } from "./block.js";
import {
  CONTEXT_STRING_FIELDS,
  DICTIONARY_STRING_FIELDS,
  FINDING_ROW_FIELD_GROUPS,
  type FindingRow,
  NULLABLE_STRING_FIELDS,
  NUMBER_FIELDS,
  normalizeFindingRow,
  normalizeSourceFinding,
  PLAIN_STRING_FIELDS,
  STRING_ARRAY_FIELDS,
} from "./finding-row.js";

const FINDING_DATA_FIELDS = FindingBlockSchema.fields
  .filter(
    ({ localName }) =>
      localName !== "sequence" && localName !== "datasetVersion" && localName !== "rowCount",
  )
  .map(({ localName }) => localName);

function makeRow(overrides: Partial<FindingRow> = {}): FindingRow {
  return normalizeFindingRow({
    group: "group",
    repo: "repo",
    image: "image",
    severity: "high",
    packageType: "npm",
    status: "open",
    advisoryType: "cve",
    buildType: "container",
    type: "vulnerability",
    cvss: 7.5,
    kaiStatus: null,
    riskFactors: ["reachable"],
    applicableRules: ["rule-1"],
    ...overrides,
  });
}

describe("finding row mapper", () => {
  it("maps all 26 fields with category-appropriate coercion", () => {
    const row = normalizeFindingRow({
      group: "group",
      repo: 42,
      image: false,
      cve: null,
      packageName: undefined,
      packageVersion: 42,
      path: false,
      severity: "high",
      packageType: 7,
      status: true,
      advisoryType: "cve",
      buildType: "container",
      type: "vulnerability",
      cvss: "7.5",
      owner: "platform",
      description: { unexpected: "object" },
      kaiStatus: "",
      riskFactors: ["reachable", 2, null],
      applicableRules: "not-an-array",
    });

    expect(Object.keys(row).sort()).toEqual([...FINDING_DATA_FIELDS].sort());
    expect(row).toMatchObject({
      group: "group",
      repo: "42",
      image: "false",
      cve: "",
      packageName: "",
      packageVersion: "42",
      path: "false",
      description: "",
      owner: "platform",
      severity: "high",
      packageType: "7",
      status: "true",
      cvss: 7.5,
      kaiStatus: "",
      riskFactors: ["reachable", "2", ""],
      applicableRules: [],
    });
  });

  it("partitions every field exactly once", () => {
    const groupedFields = Object.values(FINDING_ROW_FIELD_GROUPS).flat();
    expect(groupedFields).toHaveLength(FINDING_DATA_FIELDS.length);
    expect(new Set(groupedFields).size).toBe(FINDING_DATA_FIELDS.length);
    expect([...groupedFields].sort()).toEqual([...FINDING_DATA_FIELDS].sort());
    expect(Object.keys(packFindingColumns([makeRow()])).sort()).toEqual(
      [...FINDING_DATA_FIELDS].sort(),
    );
  });

  it("preserves source hierarchy and source-specific special cases", () => {
    const inheritedBuildType = normalizeSourceFinding({
      group: "group-key",
      repo: "repo-key",
      image: "image-key",
      imageBuildType: "image-build",
      vulnerability: {
        group: "wrong-group",
        repo: "wrong-repo",
        image: "wrong-image",
        buildType: null,
        riskFactors: { reachable: true, exploitable: false },
        applicableRules: ["rule-1", 2],
        kaiStatus: "",
      },
    });
    const explicitBuildType = normalizeSourceFinding({
      group: "g",
      repo: "r",
      image: "i",
      imageBuildType: "image-build",
      vulnerability: { buildType: "finding-build", kaiStatus: null },
    });

    expect(inheritedBuildType).toMatchObject({
      group: "group-key",
      repo: "repo-key",
      image: "image-key",
      buildType: "image-build",
      riskFactors: ["reachable", "exploitable"],
      applicableRules: ["rule-1", "2"],
      kaiStatus: "",
    });
    expect(explicitBuildType.buildType).toBe("finding-build");
    expect(explicitBuildType.kaiStatus).toBeNull();
  });

  it("matches every field to its protobuf encoding shape", () => {
    const fieldsByLocalName = new Map(
      FindingBlockSchema.fields.map((field) => [field.localName, field]),
    );

    for (const fieldName of [...CONTEXT_STRING_FIELDS, ...PLAIN_STRING_FIELDS]) {
      const descriptor = fieldsByLocalName.get(fieldName);
      expect(descriptor?.fieldKind).toBe("list");
      if (descriptor?.fieldKind === "list") {
        expect(descriptor.listKind).toBe("scalar");
        expect(descriptor.scalar).toBe(ScalarType.STRING);
      }
    }

    for (const fieldName of DICTIONARY_STRING_FIELDS) {
      const descriptor = fieldsByLocalName.get(fieldName);
      expect(descriptor?.fieldKind).toBe("message");
      if (descriptor?.fieldKind === "message") {
        expect(descriptor.message.typeName).toBe("findings.v2.DictColumn");
      }
    }

    for (const fieldName of NUMBER_FIELDS) {
      const descriptor = fieldsByLocalName.get(fieldName);
      expect(descriptor?.fieldKind).toBe("list");
      if (descriptor?.fieldKind === "list") {
        expect(descriptor.listKind).toBe("scalar");
        expect(descriptor.scalar).toBe(ScalarType.DOUBLE);
      }
    }

    for (const fieldName of NULLABLE_STRING_FIELDS) {
      const descriptor = fieldsByLocalName.get(fieldName);
      expect(descriptor?.fieldKind).toBe("message");
      if (descriptor?.fieldKind === "message") {
        expect(descriptor.message.typeName).toBe("findings.v2.SparseStringColumn");
      }
    }

    for (const fieldName of STRING_ARRAY_FIELDS) {
      const descriptor = fieldsByLocalName.get(fieldName);
      expect(descriptor?.fieldKind).toBe("message");
      if (descriptor?.fieldKind === "message") {
        expect(descriptor.message.typeName).toBe("findings.v2.OffsetStringArrays");
      }
    }
  });

  it("round trips every field category through protobuf binary", () => {
    const row = makeRow({
      group: "group-value",
      cve: "cve-value",
      severity: "critical",
      cvss: 9.8,
      kaiStatus: "",
      riskFactors: ["reachable", "public"],
      applicableRules: [],
    });
    const second = makeRow({
      group: "group-2",
      cve: "cve-2",
      severity: "low",
      cvss: 2.1,
      kaiStatus: null,
      riskFactors: [],
      applicableRules: ["rule-2"],
    });
    const encoded = toBinary(
      FindingBlockSchema,
      rowsToFindingBlock([row, second], 7n, "dataset-7"),
    );
    const decoded = fromBinary(FindingBlockSchema, encoded);

    for (const field of [...CONTEXT_STRING_FIELDS, ...PLAIN_STRING_FIELDS]) {
      expect(decoded[field]).toEqual([row[field], second[field]]);
    }
    for (const field of DICTIONARY_STRING_FIELDS) {
      expect(decodeDictColumn(decoded[field]!)).toEqual([row[field], second[field]]);
    }
    expect(decoded.cvss).toEqual([row.cvss, second.cvss]);
    expect(decoded.kaiStatus).toMatchObject({ rowIndices: [0], values: [""] });
    for (const field of STRING_ARRAY_FIELDS) {
      expect(decodeOffsetStringArrays(decoded[field]!, 2)).toEqual([row[field], second[field]]);
    }
  });
});
