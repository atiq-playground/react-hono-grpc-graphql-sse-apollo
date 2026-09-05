import http2 from "node:http2";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import Redis from "ioredis";
import { ClickHouseWriter, createProducerClickHouseClient } from "./clickhouse-writer.js";
import {
  DATASET_EVENTS_MAXLEN,
  DATASET_EVENTS_STREAM,
  DATASET_VERSION,
  PRODUCER_HOST,
  PRODUCER_MAX_CHANGES,
  PRODUCER_PORT,
  PRODUCER_SIMULATE_CHANGES_INTERVAL_MS,
  REDIS_URL,
} from "./env.js";
import { createDatasetEventPublisher } from "./event-publisher.js";
import { registerIngestService } from "./ingest-service.js";
import { initProducerSentry } from "./sentry.js";
import { startDevelopmentSimulator } from "./simulator.js";

async function main(): Promise<void> {
  initProducerSentry();
  const clickhouse = createProducerClickHouseClient();
  const writer = new ClickHouseWriter({ client: clickhouse });
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  const publisher = createDatasetEventPublisher({
    redis,
    stream: DATASET_EVENTS_STREAM,
    maxLength: DATASET_EVENTS_MAXLEN,
    datasetVersion: DATASET_VERSION,
  });

  const server = http2.createServer(
    connectNodeAdapter({
      routes: (router) => {
        registerIngestService(router, {
          writer,
          publisher,
          datasetVersion: DATASET_VERSION,
          maxChanges: PRODUCER_MAX_CHANGES,
        });
      },
    }),
  );

  await new Promise<void>((resolve, reject) => {
    server.listen(PRODUCER_PORT, PRODUCER_HOST, () => resolve());
    server.on("error", reject);
  });
  console.info(
    JSON.stringify({
      message: "producer listening",
      address: `http://${PRODUCER_HOST}:${PRODUCER_PORT}`,
      datasetVersion: DATASET_VERSION,
      datasetEventsStream: DATASET_EVENTS_STREAM,
      datasetEventsMaxLength: DATASET_EVENTS_MAXLEN,
    }),
  );
  const stopSimulator = startDevelopmentSimulator({
    writer,
    publisher,
    intervalMs: PRODUCER_SIMULATE_CHANGES_INTERVAL_MS,
  });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopSimulator?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    redis.disconnect();
    await clickhouse.close();
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: unknown) => {
  console.error("producer failed:", error);
  process.exit(1);
});
