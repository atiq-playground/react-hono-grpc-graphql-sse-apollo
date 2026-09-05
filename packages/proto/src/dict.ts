import { create } from "@bufbuild/protobuf";
import type { DictColumn } from "./gen/findings/v1/findings_pb.js";
import { DictColumnSchema } from "./gen/findings/v1/findings_pb.js";

/**
 * Encode a string column with dictionary compression for one block.
 * Indices are into the returned dictionary (self-contained block).
 */
export function encodeDictColumn(values: readonly string[]): DictColumn {
  const dictionary: string[] = [];
  const indexByValue = new Map<string, number>();
  const indices = new Array<number>(values.length);

  for (let position = 0; position < values.length; position++) {
    // biome-ignore lint/style/noNonNullAssertion: position is bounded by values.length.
    const value = values[position]!;
    let index = indexByValue.get(value);
    if (index === undefined) {
      index = dictionary.length;
      dictionary.push(value);
      indexByValue.set(value, index);
    }
    indices[position] = index;
  }

  return create(DictColumnSchema, {
    dictionary,
    indices,
  });
}

/** Decode a DictColumn back to a dense string array (one entry per row). */
export function decodeDictColumn(column: DictColumn): string[] {
  const { dictionary, indices } = column;
  const out: string[] = new Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    if (index === undefined) {
      throw new Error(`DictColumn missing index at ${i}`);
    }
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
