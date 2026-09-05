/** Server-side row ↔ columnar FindingBlock ingestion helpers. */
import { create } from "@bufbuild/protobuf";
import {
  appendOffsetRow,
  createDictEncodeState,
  createOffsetEncodeState,
  decodeDictColumn,
  decodeOffsetStringArrays,
  type FindingBlock,
  FindingBlockSchema,
  internDictValue,
} from "@repo/proto";
import type { PackedFindingColumns } from "./block.types.js";
import { PRODUCER_BLOCK_SIZE, PRODUCER_MAX_BLOCK_ROWS } from "./env.js";
import {
  CONTEXT_STRING_FIELDS,
  DICTIONARY_STRING_FIELDS,
  FINDING_ROW_FIELD_GROUPS,
  type FindingRow,
  NULLABLE_STRING_FIELDS,
  NUMBER_FIELDS,
  normalizeFindingRow,
  PLAIN_STRING_FIELDS,
  STRING_ARRAY_FIELDS,
} from "./finding-row.js";

export const BLOCK_SIZE = PRODUCER_BLOCK_SIZE;

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

function assertDenseLength(field: string, values: readonly unknown[], rowCount: number): void {
  if (values.length !== rowCount) {
    throw new Error(`${field} length ${values.length} does not match rowCount ${rowCount}`);
  }
}

export function findingBlockToRows(block: FindingBlock): FindingRow[] {
  const rowCount = block.rowCount;
  if (rowCount === 0 || rowCount > PRODUCER_MAX_BLOCK_ROWS) {
    throw new Error(`FindingBlock rowCount ${rowCount} is outside 1..${PRODUCER_MAX_BLOCK_ROWS}`);
  }

  const columns: Record<string, readonly unknown[]> = {};
  for (const field of [...CONTEXT_STRING_FIELDS, ...PLAIN_STRING_FIELDS, ...NUMBER_FIELDS]) {
    const values = block[field];
    assertDenseLength(field, values, rowCount);
    columns[field] = values;
  }

  for (const field of DICTIONARY_STRING_FIELDS) {
    const packed = block[field];
    if (!packed) throw new Error(`FindingBlock is missing ${field}`);
    const values = decodeDictColumn(packed);
    assertDenseLength(field, values, rowCount);
    columns[field] = values;
  }

  for (const field of STRING_ARRAY_FIELDS) {
    const packed = block[field];
    if (!packed) throw new Error(`FindingBlock is missing ${field}`);
    if (packed.offsets[0] !== 0 || packed.offsets[rowCount] !== packed.values.length) {
      throw new Error(`${field} offsets do not span the packed values`);
    }
    columns[field] = decodeOffsetStringArrays(packed, rowCount);
  }

  const sparseField = NULLABLE_STRING_FIELDS[0];
  const sparse = block[sparseField];
  if (!sparse || sparse.rowIndices.length !== sparse.values.length) {
    throw new Error(`FindingBlock has an invalid ${sparseField} sparse column`);
  }
  const sparseValues = new Array<string | null>(rowCount).fill(null);
  for (let index = 0; index < sparse.rowIndices.length; index++) {
    const rowIndex = sparse.rowIndices[index]!;
    if (rowIndex >= rowCount || sparseValues[rowIndex] !== null) {
      throw new Error(`${sparseField} has an invalid row index ${rowIndex}`);
    }
    sparseValues[rowIndex] = sparse.values[index]!;
  }
  columns[sparseField] = sparseValues;

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const raw: Record<string, unknown> = {};
    for (const field of Object.keys(columns)) {
      raw[field] = columns[field]![rowIndex];
    }
    return normalizeFindingRow(raw);
  });
}
