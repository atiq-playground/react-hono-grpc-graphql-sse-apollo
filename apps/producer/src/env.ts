import { datasetEventsStreamKey } from "@repo/shared";
import { z } from "zod/mini";

// [schemas]

const NonEmptyString = z.string().check(z.minLength(1), z.maxLength(2048));
const DatasetVersion = z.string().check(z.minLength(1), z.maxLength(128));
const LocalPath = z.string().check(z.minLength(1), z.maxLength(4096), z.regex(/^[^\0]+$/));

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

export const CLICKHOUSE_URL = stringEnv("CLICKHOUSE_URL", "http://127.0.0.1:8123");
export const CLICKHOUSE_USER = stringEnv("CLICKHOUSE_USER", "default");
export const CLICKHOUSE_PASSWORD = stringEnv("CLICKHOUSE_PASSWORD", "", true);
export const CLICKHOUSE_DB = stringEnv("CLICKHOUSE_DB", "default");

export const REDIS_URL = stringEnv("REDIS_URL", "redis://127.0.0.1:6379");
export const DATASET_EVENTS_STREAM = stringEnv(
  "DATASET_EVENTS_STREAM",
  datasetEventsStreamKey(DATASET_VERSION),
);
export const DATASET_EVENTS_MAXLEN = integerEnv("DATASET_EVENTS_MAXLEN", 10_000, 1, 10_000_000);

export const PRODUCER_HOST = stringEnv("PRODUCER_HOST", "127.0.0.1");
export const PRODUCER_PORT = integerEnv("PRODUCER_PORT", 50_051, 1, 65_535);
export const PRODUCER_URL = stringEnv("PRODUCER_URL", `http://${PRODUCER_HOST}:${PRODUCER_PORT}`);
export const PRODUCER_BLOCK_SIZE = integerEnv("PRODUCER_BLOCK_SIZE", 2_000, 1, 10_000);
export const PRODUCER_MAX_BLOCK_ROWS = integerEnv("PRODUCER_MAX_BLOCK_ROWS", 10_000, 1, 50_000);
export const PRODUCER_MAX_CHANGES = integerEnv("PRODUCER_MAX_CHANGES", 500, 1, 5_000);
export const PRODUCER_SIMULATE_CHANGES_INTERVAL_MS = integerEnv(
  "PRODUCER_SIMULATE_CHANGES_INTERVAL_MS",
  0,
  0,
  86_400_000,
);
export const INGEST_SOURCE = LocalPath.parse(
  process.env.INGEST_SOURCE ?? "apps/producer/data/sample/ui_demo.sample.json",
);
