import type {
  DictionaryField,
  FindingRow,
  OffsetStringArrayField,
  RepeatedNumberField,
  RepeatedStringField,
  SourceFindingInput,
  SparseStringField,
} from "./finding-row.types.js";

export type { FindingDataField, FindingRow, SourceFindingInput } from "./finding-row.types.js";

export const CONTEXT_STRING_FIELDS = [
  "group",
  "repo",
  "image",
] as const satisfies readonly RepeatedStringField[];

export const PLAIN_STRING_FIELDS = [
  "cve",
  "packageName",
  "packageVersion",
  "path",
  "description",
  "cause",
  "exploit",
  "fixDate",
  "published",
  "layerTime",
  "link",
  "owner",
  "vecStr",
] as const satisfies readonly RepeatedStringField[];

export const DICTIONARY_STRING_FIELDS = [
  "severity",
  "packageType",
  "status",
  "advisoryType",
  "buildType",
  "type",
] as const satisfies readonly DictionaryField[];

export const NUMBER_FIELDS = ["cvss"] as const satisfies readonly RepeatedNumberField[];
export const NULLABLE_STRING_FIELDS = ["kaiStatus"] as const satisfies readonly SparseStringField[];
export const STRING_ARRAY_FIELDS = [
  "riskFactors",
  "applicableRules",
] as const satisfies readonly OffsetStringArrayField[];

// Context and plain strings share protobuf encoding but remain separate source semantics.
const REPEATED_STRING_FIELDS = [...CONTEXT_STRING_FIELDS, ...PLAIN_STRING_FIELDS] as const;
const STRING_FIELDS = [...REPEATED_STRING_FIELDS, ...DICTIONARY_STRING_FIELDS] as const;

const EMPTY_STRING_VALUES = Object.fromEntries(STRING_FIELDS.map((field) => [field, ""])) as Record<
  (typeof STRING_FIELDS)[number],
  string
>;
const EMPTY_FINDING_ROW = {
  ...EMPTY_STRING_VALUES,
  ...Object.fromEntries(NUMBER_FIELDS.map((field) => [field, 0])),
  ...Object.fromEntries(NULLABLE_STRING_FIELDS.map((field) => [field, null])),
  ...Object.fromEntries(STRING_ARRAY_FIELDS.map((field) => [field, []])),
} as FindingRow;

export const FINDING_ROW_FIELD_GROUPS = {
  context: CONTEXT_STRING_FIELDS,
  plain: PLAIN_STRING_FIELDS,
  dictionary: DICTIONARY_STRING_FIELDS,
  number: NUMBER_FIELDS,
  nullableString: NULLABLE_STRING_FIELDS,
  stringArray: STRING_ARRAY_FIELDS,
} as const;

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  return 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const values = new Array<string>(value.length);
  for (let index = 0; index < value.length; index++) {
    values[index] = asString(value[index]);
  }
  return values;
}

export function normalizeFindingRow(
  source: Readonly<Partial<Record<keyof FindingRow, unknown>>>,
): FindingRow {
  const row = Object.assign({}, EMPTY_FINDING_ROW);

  for (let index = 0; index < STRING_FIELDS.length; index++) {
    const field = STRING_FIELDS[index]!;
    const value = source[field];
    row[field] = typeof value === "string" ? value : asString(value);
  }

  row.cvss = asNumber(source.cvss);
  const kaiStatus = source.kaiStatus;
  row.kaiStatus = kaiStatus === null || kaiStatus === undefined ? null : asString(kaiStatus);
  row.riskFactors = asStringArray(source.riskFactors);
  row.applicableRules = asStringArray(source.applicableRules);
  return row;
}

export function normalizeSourceFinding({
  group,
  repo,
  image,
  imageBuildType,
  vulnerability,
}: SourceFindingInput): FindingRow {
  const riskFactors = vulnerability.riskFactors;
  const normalizedRiskFactors =
    riskFactors !== null && typeof riskFactors === "object" && !Array.isArray(riskFactors)
      ? Object.keys(riskFactors)
      : asStringArray(riskFactors);

  return normalizeFindingRow({
    ...vulnerability,
    group,
    repo,
    image,
    buildType: vulnerability.buildType ?? imageBuildType,
    riskFactors: normalizedRiskFactors,
    applicableRules: asStringArray(vulnerability.applicableRules),
  });
}
