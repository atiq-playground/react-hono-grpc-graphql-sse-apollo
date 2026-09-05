import { create } from "@bufbuild/protobuf";
import type { DictColumn } from "./gen/findings/v2/findings_pb.js";
import { DictColumnSchema } from "./gen/findings/v2/findings_pb.js";

export type DictEncodeState = {
  dictionary: string[];
  indices: number[];
  indexByValue: Map<string, number>;
};

export function createDictEncodeState(rowCount: number): DictEncodeState {
  return {
    dictionary: [],
    indices: new Array<number>(rowCount),
    indexByValue: new Map<string, number>(),
  };
}

export function internDictValue(state: DictEncodeState, value: string, position: number): void {
  let index = state.indexByValue.get(value);
  if (index === undefined) {
    index = state.dictionary.length;
    state.dictionary.push(value);
    state.indexByValue.set(value, index);
  }
  state.indices[position] = index;
}

/**
 * Encode a string column with dictionary compression for one block.
 * Indices are into the returned dictionary (self-contained block).
 */
export function encodeDictColumn(values: readonly string[]): DictColumn {
  const state = createDictEncodeState(values.length);
  for (let position = 0; position < values.length; position++) {
    internDictValue(state, values[position] ?? "", position);
  }
  return create(DictColumnSchema, {
    dictionary: state.dictionary,
    indices: state.indices,
  });
}

/**
 * Intern each block-local dictionary entry once.
 * `remap[i]` is the destination id for `dictionary[i]`.
 */
export function internDictEntries(
  dictionary: readonly string[],
  intern: (value: string) => number,
): number[] {
  const remap = new Array<number>(dictionary.length);
  for (let position = 0; position < dictionary.length; position++) {
    remap[position] = intern(dictionary[position] ?? "");
  }
  return remap;
}

/** Decode a DictColumn back to a dense string array (one entry per row). */
export function decodeDictColumn(column: DictColumn): string[] {
  const { dictionary, indices } = column;
  const out: string[] = new Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]!;
    const value = dictionary[index];
    if (value === undefined) {
      throw new Error(`DictColumn index ${index} out of range at row ${i}`);
    }
    out[i] = value;
  }
  return out;
}

/** Encode, decode, and assert equality — used by the T03 smoke script. */
export function assertDictRoundTrip(values: readonly string[]): string[] {
  const encoded = encodeDictColumn(values);
  const decoded = decodeDictColumn(encoded);
  if (decoded.length !== values.length) {
    throw new Error(`Dict round trip length mismatch: ${decoded.length} !== ${values.length}`);
  }
  for (let i = 0; i < values.length; i++) {
    if (decoded[i] !== values[i]) {
      throw new Error(
        `Dict round trip mismatch at ${i}: ${JSON.stringify(decoded[i])} !== ${JSON.stringify(values[i])}`,
      );
    }
  }
  return decoded;
}
