import type { DictColumn, FindingBlock, OffsetStringArrays, SparseStringColumn } from "@repo/proto";

import type {
  CONTEXT_STRING_FIELDS,
  DICTIONARY_STRING_FIELDS,
  NULLABLE_STRING_FIELDS,
  NUMBER_FIELDS,
  PLAIN_STRING_FIELDS,
  STRING_ARRAY_FIELDS,
} from "./finding-row.js";

export type ContextStringField = (typeof CONTEXT_STRING_FIELDS)[number];
export type PlainStringField = (typeof PLAIN_STRING_FIELDS)[number];
export type DictionaryStringField = (typeof DICTIONARY_STRING_FIELDS)[number];
export type NumberField = (typeof NUMBER_FIELDS)[number];
export type NullableStringField = (typeof NULLABLE_STRING_FIELDS)[number];
export type StringArrayField = (typeof STRING_ARRAY_FIELDS)[number];

type FindingRowShape = Record<ContextStringField, string> &
  Record<PlainStringField, string> &
  Record<DictionaryStringField, string> &
  Record<NumberField, number> &
  Record<NullableStringField, string | null> &
  Record<StringArrayField, string[]>;

export type FindingRow = Checked<FindingRowShape, FindingRowValidationChecklist>;

export interface SourceFindingInput {
  group: string;
  repo: string;
  image: string;
  imageBuildType: string;
  vulnerability: Readonly<Record<string, unknown>>;
}

type FindingEnvelopeField = "$typeName" | "$unknown" | "sequence" | "datasetVersion" | "rowCount";
export type FindingDataField = Exclude<keyof FindingBlock, FindingEnvelopeField>;

export type RepeatedStringField = FieldsWithExactShape<string[]>;
export type RepeatedNumberField = FieldsWithExactShape<number[]>;
export type DictionaryField = FieldsWithExactShape<DictColumn | undefined>;
export type SparseStringField = FieldsWithExactShape<SparseStringColumn | undefined>;
export type OffsetStringArrayField = FieldsWithExactShape<OffsetStringArrays | undefined>;

type FindingFieldGroups = readonly [
  typeof CONTEXT_STRING_FIELDS,
  typeof PLAIN_STRING_FIELDS,
  typeof DICTIONARY_STRING_FIELDS,
  typeof NUMBER_FIELDS,
  typeof NULLABLE_STRING_FIELDS,
  typeof STRING_ARRAY_FIELDS,
];

type FindingRowValidationChecklist = readonly [
  fieldsAreUnique: AreUnique<FindingFieldGroups>,
  allDataFieldsAreDeclared: Equal<FindingFieldGroups[number][number], FindingDataField>,
  repeatedStringEncodingMatches: Equal<ContextStringField | PlainStringField, RepeatedStringField>,
  dictionaryEncodingMatches: Equal<DictionaryStringField, DictionaryField>,
  numberEncodingMatches: Equal<NumberField, RepeatedNumberField>,
  nullableStringEncodingMatches: Equal<NullableStringField, SparseStringField>,
  stringArrayEncodingMatches: Equal<StringArrayField, OffsetStringArrayField>,
];

type Checked<Value, _Checks extends readonly true[]> = Value;

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

type AreUnique<
  Groups extends readonly (readonly PropertyKey[])[],
  Seen extends PropertyKey = never,
> = Groups extends readonly [
  infer Group extends readonly PropertyKey[],
  ...infer Rest extends readonly (readonly PropertyKey[])[],
]
  ? Group extends readonly [
      infer Field extends PropertyKey,
      ...infer GroupRest extends readonly PropertyKey[],
    ]
    ? Field extends Seen
      ? false
      : AreUnique<readonly [GroupRest, ...Rest], Seen | Field>
    : AreUnique<Rest, Seen>
  : true;

type FieldsWithExactShape<Shape> = {
  [Field in FindingDataField]: Equal<FindingBlock[Field], Shape> extends true ? Field : never;
}[FindingDataField];
