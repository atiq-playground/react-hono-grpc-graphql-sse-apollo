import { create } from "@bufbuild/protobuf";
import type { OffsetStringArrays } from "./gen/findings/v1/findings_pb.js";
import { OffsetStringArraysSchema } from "./gen/findings/v1/findings_pb.js";

export type OffsetEncodeState = {
  values: string[];
  offsets: number[];
};

export function createOffsetEncodeState(rowCount: number): OffsetEncodeState {
  const offsets = new Array<number>(rowCount + 1);
  offsets[0] = 0;
  return { values: [], offsets };
}

export function appendOffsetRow(
  state: OffsetEncodeState,
  items: readonly string[],
  rowIndex: number,
): void {
  for (const item of items) {
    state.values.push(item);
  }
  state.offsets[rowIndex + 1] = state.values.length;
}

/** Pack row-oriented string[][] into offset arrays. */
export function encodeOffsetStringArrays(rows: readonly (readonly string[])[]): OffsetStringArrays {
  const state = createOffsetEncodeState(rows.length);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    appendOffsetRow(state, rows[rowIndex] ?? [], rowIndex);
  }
  return create(OffsetStringArraysSchema, { values: state.values, offsets: state.offsets });
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
