import { type ClickHouseClient, createClient } from "@clickhouse/client";
import Redis from "ioredis";
import {
  CLICKHOUSE_DB,
  CLICKHOUSE_PASSWORD,
  CLICKHOUSE_URL,
  CLICKHOUSE_USER,
  REDIS_URL,
} from "../env.js";

export interface GatewayContext {
  readonly ch: ClickHouseClient;
  readonly redis: Redis;
}

export function createClickHouse(): ClickHouseClient {
  return createClient({
    url: CLICKHOUSE_URL,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: CLICKHOUSE_DB,
  });
}

export function createRedis(): Redis {
  return new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}
