import {
  FINDING_CURSOR_MAX_LENGTH,
  FindingIdSchema,
  type FindingSort,
  parseFindingCursor,
} from "@repo/shared";
import { z } from "zod/mini";
import { throwClientError } from "./errors.js";

const NUMBER_SORT_FIELDS = new Set(["cvss"]);
const NULLABLE_SORT_FIELDS = new Set(["publishedAt", "fixedAt"]);
const DATE_SORT_FIELDS = new Set(["publishedAt", "fixedAt", "updatedAt"]);
const CLICKHOUSE_DATE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;

// [schemas]

const CursorValueSchema = z.union([
  z.string().check(z.maxLength(256)),
  z.number().check(z.refine(Number.isFinite, "Cursor number must be finite")),
  z.null(),
]);
const CursorPayloadSchema = z.object({
  s: CursorValueSchema,
  id: FindingIdSchema,
});

// [types]

export interface CursorPayload {
  readonly s: string | number | null;
  readonly id: string;
}

function validateKeys(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Cursor payload must be an object");
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "id" || keys[1] !== "s") {
    throw new Error("Cursor payload has unexpected fields");
  }
}

function validateSortValue(payload: CursorPayload, sort: FindingSort): CursorPayload {
  if (payload.s === null) {
    if (!NULLABLE_SORT_FIELDS.has(sort.field)) {
      throw new Error("Cursor null sort value does not match sort field");
    }
    return payload;
  }
  if (NUMBER_SORT_FIELDS.has(sort.field)) {
    if (typeof payload.s !== "number") {
      throw new Error("Cursor sort value must be numeric");
    }
    return payload;
  }
  if (typeof payload.s !== "string") {
    throw new Error("Cursor sort value must be text");
  }
  if (DATE_SORT_FIELDS.has(sort.field) && !CLICKHOUSE_DATE.test(payload.s)) {
    throw new Error("Cursor date sort value is malformed");
  }
  return payload;
}

export function encodeCursor(payload: CursorPayload): string {
  const validated = CursorPayloadSchema.parse(payload);
  const cursor = Buffer.from(JSON.stringify(validated), "utf8").toString("base64url");
  return parseFindingCursor(cursor);
}

export function decodeCursor(cursor: string, sort: FindingSort): CursorPayload {
  try {
    const bounded = parseFindingCursor(cursor);
    if (bounded.length > FINDING_CURSOR_MAX_LENGTH || !/^[A-Za-z0-9_-]+$/.test(bounded)) {
      throw new Error("Cursor encoding is malformed");
    }
    const bytes = Buffer.from(bounded, "base64url");
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    validateKeys(parsed);
    return validateSortValue(CursorPayloadSchema.parse(parsed), sort);
  } catch {
    throwClientError("Invalid findings cursor");
  }
}
