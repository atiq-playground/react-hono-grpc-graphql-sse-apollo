import type { ConnectRouter } from "@connectrpc/connect";

import type { ClickHouseWriter } from "./clickhouse-writer.js";
import type { DatasetEventPublisher } from "./event-publisher.types.js";

export interface IngestServiceDependencies {
  writer: ClickHouseWriter;
  publisher: DatasetEventPublisher;
  datasetVersion: string;
  maxChanges: number;
}

export type RegisterIngestService = (
  router: ConnectRouter,
  dependencies: IngestServiceDependencies,
) => void;
