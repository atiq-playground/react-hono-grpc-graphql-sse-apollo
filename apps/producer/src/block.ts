/**
 * ClickHouse row -> columnar FindingBlock helpers (T05).
 */
import { create } from "@bufbuild/protobuf";
import {
  appendOffsetRow,
  createDictEncodeState,
  createOffsetEncodeState,
  type FindingBlock,
  FindingBlockSchema,
  internDictValue,
} from "@repo/proto";
import {
  CONTEXT_STRING_FIELDS,
  DICTIONARY_STRING_FIELDS,
  FINDING_ROW_FIELD_GROUPS,
  type FindingRow,
  NULLABLE_STRING_FIELDS,
  NUMBER_FIELDS,
  PLAIN_STRING_FIELDS,
  STRING_ARRAY_FIELDS,
} from "./finding-row.js";

export const BLOCK_SIZE = Number(process.env.PRODUCER_BLOCK_SIZE ?? 2_048);

type PlainColumnField =
  | (typeof CONTEXT_STRING_FIELDS)[number]
  | (typeof PLAIN_STRING_FIELDS)[number];
type PlainColumns = { [Field in PlainColumnField]: string[] };
type DictionaryColumns = {
  [Field in (typeof DICTIONARY_STRING_FIELDS)[number]]: ReturnType<typeof createDictEncodeState>;
};
type NumberColumns = {
  [Field in (typeof NUMBER_FIELDS)[number]]: number[];
};
type SparseStringColumns = {
  [Field in (typeof NULLABLE_STRING_FIELDS)[number]]: {
    rowIndices: number[];
    values: string[];
  };
};
type OffsetStringArrayColumns = {
  [Field in (typeof STRING_ARRAY_FIELDS)[number]]: ReturnType<typeof createOffsetEncodeState>;
};
type PackedFindingColumns = PlainColumns &
  DictionaryColumns &
  NumberColumns &
  SparseStringColumns &
  OffsetStringArrayColumns;
const EMPTY_PACKED_COLUMNS = Object.fromEntries(
  Object.values(FINDING_ROW_FIELD_GROUPS)
    .flat()
    .map((field) => [field, undefined]),
) as Partial<PackedFindingColumns>;

function packPlainColumns(rows: readonly FindingRow[], columns: PackedFindingColumns): void {
  for (const fields of [CONTEXT_STRING_FIELDS, PLAIN_STRING_FIELDS] as const) {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex]!;
      const column = new Array<string>(rows.length);
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        column[rowIndex] = rows[rowIndex]![field];
      }
      columns[field] = column;
    }
  }
}

function packNumberAndSparseColumns(
  rows: readonly FindingRow[],
  columns: PackedFindingColumns,
): void {
  const numberField = NUMBER_FIELDS[0];
  const sparseField = NULLABLE_STRING_FIELDS[0];
  const numberValues = new Array<number>(rows.length);
  const rowIndices: number[] = [];
  const sparseValues: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    numberValues[rowIndex] = row[numberField];
    const sparseValue = row[sparseField];
    if (sparseValue !== null) {
      rowIndices.push(rowIndex);
      sparseValues.push(sparseValue);
    }
  }

  columns[numberField] = numberValues;
  columns[sparseField] = { rowIndices, values: sparseValues };
}

function packDictionaryColumns(rows: readonly FindingRow[], columns: PackedFindingColumns): void {
  for (let fieldIndex = 0; fieldIndex < DICTIONARY_STRING_FIELDS.length; fieldIndex++) {
    const field = DICTIONARY_STRING_FIELDS[fieldIndex]!;
    const column = createDictEncodeState(rows.length);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      internDictValue(column, rows[rowIndex]![field], rowIndex);
    }
    columns[field] = column;
  }
}

function packOffsetStringArrays(rows: readonly FindingRow[], columns: PackedFindingColumns): void {
  for (let fieldIndex = 0; fieldIndex < STRING_ARRAY_FIELDS.length; fieldIndex++) {
    const field = STRING_ARRAY_FIELDS[fieldIndex]!;
    const column = createOffsetEncodeState(rows.length);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      appendOffsetRow(column, rows[rowIndex]![field], rowIndex);
    }
    columns[field] = column;
  }
}

export function packFindingColumns(rows: readonly FindingRow[]): PackedFindingColumns {
  const columns = Object.assign({}, EMPTY_PACKED_COLUMNS) as PackedFindingColumns;
  packPlainColumns(rows, columns);
  packNumberAndSparseColumns(rows, columns);
  packDictionaryColumns(rows, columns);
  packOffsetStringArrays(rows, columns);
  return columns;
}

export function rowsToFindingBlock(
  rows: readonly FindingRow[],
  sequence: bigint,
  datasetVersion: string,
): FindingBlock {
  return create(FindingBlockSchema, {
    sequence,
    datasetVersion,
    rowCount: rows.length,
    ...packFindingColumns(rows),
  });
}
