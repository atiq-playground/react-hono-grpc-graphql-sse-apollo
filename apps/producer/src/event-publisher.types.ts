import type { AggregateScope, ExploreFinding } from "@repo/shared";
import type Redis from "ioredis";

export interface DatasetEventPublisherOptions {
  redis: Redis;
  stream: string;
  maxLength: number;
  datasetVersion: string;
}

export interface DatasetEventPublisher {
  publishFindingUpserted(finding: ExploreFinding): Promise<string>;
  publishFindingDeleted(id: string): Promise<string>;
  publishAggregatesInvalidated(scopes: readonly AggregateScope[]): Promise<string>;
  publishDatasetVersionChanged(): Promise<string>;
}
