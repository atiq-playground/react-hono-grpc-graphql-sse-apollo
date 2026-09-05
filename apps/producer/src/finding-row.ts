import type { DictColumn, FindingBlock, OffsetStringArrays, SparseStringColumn } from "@repo/proto";

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

type FieldsOf<Group extends readonly PropertyKey[], Value> = {
  [Field in Group[number]]: Value;
};

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type Assert<Condition extends true> = Condition;
type IsUnique<
  Fields extends readonly PropertyKey[],
  Seen extends PropertyKey = never,
> = Fields extends readonly [
  infer Field extends PropertyKey,
  ...infer Rest extends readonly PropertyKey[],
]
  ? Field extends Seen
    ? false
    : IsUnique<Rest, Seen | Field>
  : true;

type FindingEnvelopeField = "$typeName" | "$unknown" | "sequence" | "datasetVersion" | "rowCount";
export type FindingDataField = Exclude<keyof FindingBlock, FindingEnvelopeField>;
type FieldsWithExactShape<Shape> = {
  [Field in FindingDataField]: Equal<FindingBlock[Field], Shape> extends true ? Field : never;
}[FindingDataField];
type RepeatedStringField = FieldsWithExactShape<string[]>;
type RepeatedNumberField = FieldsWithExactShape<number[]>;
type DictionaryField = FieldsWithExactShape<DictColumn | undefined>;
type SparseStringField = FieldsWithExactShape<SparseStringColumn | undefined>;
type OffsetStringArrayField = FieldsWithExactShape<OffsetStringArrays | undefined>;

// Context and plain strings share protobuf encoding but remain separate source semantics.
const REPEATED_STRING_FIELDS = [...CONTEXT_STRING_FIELDS, ...PLAIN_STRING_FIELDS] as const;
const STRING_FIELDS = [...REPEATED_STRING_FIELDS, ...DICTIONARY_STRING_FIELDS] as const;
const ALL_FINDING_ROW_FIELDS = [
  ...STRING_FIELDS,
  ...NUMBER_FIELDS,
  ...NULLABLE_STRING_FIELDS,
  ...STRING_ARRAY_FIELDS,
] as const;

type FieldGroupsAreValid = Assert<IsUnique<typeof ALL_FINDING_ROW_FIELDS>> &
  Assert<Equal<(typeof ALL_FINDING_ROW_FIELDS)[number], FindingDataField>> &
  Assert<Equal<(typeof REPEATED_STRING_FIELDS)[number], RepeatedStringField>> &
  Assert<Equal<(typeof DICTIONARY_STRING_FIELDS)[number], DictionaryField>> &
  Assert<Equal<(typeof NUMBER_FIELDS)[number], RepeatedNumberField>> &
  Assert<Equal<(typeof NULLABLE_STRING_FIELDS)[number], SparseStringField>> &
  Assert<Equal<(typeof STRING_ARRAY_FIELDS)[number], OffsetStringArrayField>>;

const EMPTY_STRING_VALUES = Object.fromEntries(
  STRING_FIELDS.map((field) => [field, ""]),
) as FieldsOf<typeof STRING_FIELDS, string>;
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

export type FindingRow = FieldGroupsAreValid extends true
  ? FieldsOf<typeof CONTEXT_STRING_FIELDS, string> &
      FieldsOf<typeof PLAIN_STRING_FIELDS, string> &
      FieldsOf<typeof DICTIONARY_STRING_FIELDS, string> &
      FieldsOf<typeof NUMBER_FIELDS, number> &
      FieldsOf<typeof NULLABLE_STRING_FIELDS, string | null> &
      FieldsOf<typeof STRING_ARRAY_FIELDS, string[]>
  : never;

export interface SourceFindingInput {
  group: string;
  repo: string;
  image: string;
  imageBuildType: string;
  vulnerability: Readonly<Record<string, unknown>>;
}

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

export function normalizeFindingRow(source: Readonly<Record<string, unknown>>): FindingRow {
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
