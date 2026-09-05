import {
  type AggregateScope,
  type DatasetEvent,
  type ExploreFinding,
  encodeDatasetEvent,
} from "@repo/shared";

import type {
  DatasetEventPublisher,
  DatasetEventPublisherOptions,
} from "./event-publisher.types.js";

export function createDatasetEventPublisher({
  redis,
  stream,
  maxLength,
  datasetVersion,
}: DatasetEventPublisherOptions): DatasetEventPublisher {
  async function publish(event: DatasetEvent): Promise<string> {
    const payload = encodeDatasetEvent(event);
    const eventId = await redis.xadd(
      stream,
      "MAXLEN",
      "~",
      maxLength.toString(),
      "*",
      "event",
      payload,
    );
    if (eventId === null) throw new Error("Redis did not return a DatasetEvent entry id");
    return eventId;
  }

  function eventBase(): Pick<DatasetEvent, "v" | "datasetVersion" | "at"> {
    return {
      v: 1,
      datasetVersion,
      at: new Date().toISOString(),
    };
  }

  return {
    publishFindingUpserted(finding: ExploreFinding): Promise<string> {
      return publish({ ...eventBase(), type: "finding-upserted", finding });
    },
    publishFindingDeleted(id: string): Promise<string> {
      return publish({ ...eventBase(), type: "finding-deleted", id });
    },
    publishAggregatesInvalidated(scopes: readonly AggregateScope[]): Promise<string> {
      return publish({
        ...eventBase(),
        type: "aggregates-invalidated",
        scopes: [...scopes],
      });
    },
    publishDatasetVersionChanged(): Promise<string> {
      return publish({ ...eventBase(), type: "dataset-version-changed" });
    },
  };
}
