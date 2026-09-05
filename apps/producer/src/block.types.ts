import type { DictEncodeState, OffsetEncodeState } from "@repo/proto";

import type {
  ContextStringField,
  DictionaryStringField,
  NullableStringField,
  NumberField,
  PlainStringField,
  StringArrayField,
} from "./finding-row.types.js";

type PlainColumnField = ContextStringField | PlainStringField;
type PlainColumns = Record<PlainColumnField, string[]>;
type DictionaryColumns = Record<DictionaryStringField, DictEncodeState>;
type NumberColumns = Record<NumberField, number[]>;

interface SparseStringColumn {
  rowIndices: number[];
  values: string[];
}

type SparseStringColumns = Record<NullableStringField, SparseStringColumn>;
type OffsetStringArrayColumns = Record<StringArrayField, OffsetEncodeState>;

export type PackedFindingColumns = PlainColumns &
  DictionaryColumns &
  NumberColumns &
  SparseStringColumns &
  OffsetStringArrayColumns;
