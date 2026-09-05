import { create } from "@bufbuild/protobuf";
import type { OffsetStringArrays } from "./gen/findings/v1/findings_pb.js";
import { OffsetStringArraysSchema } from "./gen/findings/v1/findings_pb.js";

/** Pack row-oriented string[][] into offset arrays. */
export function encodeOffsetStringArrays(rows: readonly (readonly string[])[]): OffsetStringArrays {
  const values: string[] = [];
  const offsets = new Array<number>(rows.length + 1);
  offsets[0] = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    // biome-ignore lint/style/noNonNullAssertion: rowIndex is bounded by rows.length.
    const row = rows[rowIndex]!;
    for (const item of row) {
      values.push(item);
    }
    offsets[rowIndex + 1] = values.length;
  }
  return create(OffsetStringArraysSchema, { values, offsets });
}

/** Unpack offset arrays into row-oriented string[][]. */
export function decodeOffsetStringArrays(packed: OffsetStringArrays, rowCount: number): string[][] {
  const { values, offsets } = packed;
  if (offsets.length !== rowCount + 1) {
    throw new Error(
      `OffsetStringArrays offsets length ${offsets.length} !== rowCount+1 (${rowCount + 1})`,
    );
  }
  const out: string[][] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const start = offsets[i];
    const end = offsets[i + 1];
    if (start === undefined || end === undefined || end < start) {
      throw new Error(`Invalid offsets at row ${i}: ${start}..${end}`);
    }
    out[i] = values.slice(start, end);
  }
  return out;
}
