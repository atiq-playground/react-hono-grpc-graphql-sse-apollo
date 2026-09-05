function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const DATASET_VERSION = env("DATASET_VERSION", "local-1");
export const REDIS_URL = env("REDIS_URL", "redis://127.0.0.1:6379");
export const REDIS_STREAM = env("REDIS_STREAM", `findings:${DATASET_VERSION}`);
export const PRODUCER_URL = env("PRODUCER_URL", "http://127.0.0.1:50051");
export const GATEWAY_HOST = env("GATEWAY_HOST", "127.0.0.1");
export const GATEWAY_PORT = Number(env("GATEWAY_PORT", "4000"));
export const CLICKHOUSE_URL = env("CLICKHOUSE_URL", "http://127.0.0.1:8123");
export const CLICKHOUSE_USER = env("CLICKHOUSE_USER", "default");
export const CLICKHOUSE_PASSWORD = env("CLICKHOUSE_PASSWORD", "");
export const CLICKHOUSE_DB = env("CLICKHOUSE_DB", "default");
