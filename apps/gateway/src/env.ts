import { datasetEventsStreamKey } from "@repo/shared";
import { z } from "zod/mini";

// [schemas]

const NonEmptyString = z.string().check(z.minLength(1), z.maxLength(2048));
const DatasetVersion = z.string().check(z.minLength(1), z.maxLength(128));
const ExportDirectory = z.string().check(z.minLength(1), z.maxLength(2048), z.regex(/^[^\0]+$/));

function stringEnv(name: string, fallback: string, allowEmpty = false): string {
  const value = process.env[name] ?? fallback;
  return allowEmpty
    ? z.string().check(z.maxLength(2048)).parse(value)
    : NonEmptyString.parse(value);
}

function integerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  return z.number().check(z.int(), z.gte(minimum), z.lte(maximum)).parse(value);
}

export const DATASET_VERSION = DatasetVersion.parse(process.env.DATASET_VERSION ?? "local-1");
export const REDIS_URL = stringEnv("REDIS_URL", "redis://127.0.0.1:6379");
export const DATASET_EVENTS_STREAM = stringEnv(
  "DATASET_EVENTS_STREAM",
  datasetEventsStreamKey(DATASET_VERSION),
);
export const DATASET_EVENTS_MAXLEN = integerEnv("DATASET_EVENTS_MAXLEN", 10_000, 1, 10_000_000);
export const DATASET_EVENTS_COALESCE_WINDOW_MS = integerEnv(
  "DATASET_EVENTS_COALESCE_WINDOW_MS",
  250,
  0,
  10_000,
);
export const DATASET_EVENTS_COALESCE_THRESHOLD = integerEnv(
  "DATASET_EVENTS_COALESCE_THRESHOLD",
  100,
  1,
  100_000,
);

export const GATEWAY_HOST = stringEnv("GATEWAY_HOST", "127.0.0.1");
export const GATEWAY_PORT = integerEnv("GATEWAY_PORT", 4_000, 1, 65_535);
export const GRAPHQL_MAX_FIRST = integerEnv("GRAPHQL_MAX_FIRST", 200, 1, 200);
export const CLICKHOUSE_URL = stringEnv("CLICKHOUSE_URL", "http://127.0.0.1:8123");
export const CLICKHOUSE_USER = stringEnv("CLICKHOUSE_USER", "default");
export const CLICKHOUSE_PASSWORD = stringEnv("CLICKHOUSE_PASSWORD", "", true);
export const CLICKHOUSE_DB = stringEnv("CLICKHOUSE_DB", "default");
export const EXPORT_DIR = ExportDirectory.parse(process.env.EXPORT_DIR ?? ".data/exports");
export const EXPORT_SYNC_ROW_LIMIT = integerEnv("EXPORT_SYNC_ROW_LIMIT", 10_000, 1, 1_000_000);
export const EXPORT_TTL_SECONDS = integerEnv("EXPORT_TTL_SECONDS", 3_600, 60, 604_800);
