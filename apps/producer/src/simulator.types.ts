import type { ClickHouseWriter } from "./clickhouse-writer.js";
import type { DatasetEventPublisher } from "./event-publisher.types.js";

export interface DevelopmentSimulatorOptions {
  writer: ClickHouseWriter;
  publisher: DatasetEventPublisher;
  intervalMs: number;
}
