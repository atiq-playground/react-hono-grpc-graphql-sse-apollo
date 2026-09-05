# T20 Producer ingestion and change publisher

## Outcome

`apps/producer` no longer streams the corpus to consumers. It accepts
`FindingBlock`s over gRPC, writes them to ClickHouse, and publishes JSON
`DatasetEvent`s to a Redis Stream so the gateway can relay changes. The
protobuf contract stays server-to-server.

## Scope

- Proto v2 in `packages/proto/proto/findings/v2/`: an `IngestService` with
  `IngestBlocks` (client-streaming `FindingBlock`) and `ApplyChanges`
  (upserts and deletes). Remove or deprecate `StreamFindings`; regenerate with
  Buf.
- ClickHouse writer in `apps/producer/src/clickhouse-writer.ts` that unpacks
  blocks into rows with `updatedAt`, `firstSeenAt`, and `isDeleted` and inserts
  with `@clickhouse/client` in bounded batches.
- Redis Stream publisher in `apps/producer/src/event-publisher.ts` issuing
  `XADD dataset-events:{DATASET_VERSION} MAXLEN ~ {DATASET_EVENTS_MAXLEN}` for
  each event: `finding-upserted { finding }`, `finding-deleted { id }`,
  `aggregates-invalidated { scopes }`, `dataset-version-changed`.
- Event payloads validated against the `DatasetEvent` schemas from
  `packages/shared` (T23) before publishing.
- New `apps/producer/src/env.ts` centralizing `CLICKHOUSE_*`, `REDIS_URL`,
  `DATASET_VERSION`, `DATASET_EVENTS_STREAM`, `DATASET_EVENTS_MAXLEN`,
  `PRODUCER_HOST`, `PRODUCER_PORT`, and `PRODUCER_SIMULATE_CHANGES_INTERVAL_MS`.
  Update `.env.example`.
- Env-gated dev simulator (`PRODUCER_SIMULATE_CHANGES_INTERVAL_MS`, off by
  default) that applies small upserts to existing rows so the live UX is
  demonstrable locally.
- `apps/producer/scripts/ingest.ts` streams the corpus through `IngestBlocks`
  instead of inserting directly.
- Remove the full-corpus `StreamFindings` server path and the Redis
  `findings:{version}` block stream.

## Implementation evidence and deviation (T31)

- `IngestBlocksResponse` reports both `source_rows_written` and
  `current_findings`. The ingest client asserts 236,656 source rows and 236,653
  current Findings under `FINAL`.
- `IngestBlocks` emits one terminal `dataset-version-changed` event; bounded
  `ApplyChanges` emits row events.
- `PRODUCER_MAX_BLOCK_ROWS` and `PRODUCER_MAX_CHANGES` bound server inputs. The
  development simulator remains off when its interval is zero.

## Acceptance criteria

- [ ] `bunx nx run producer:ingest --force` completes through `IngestBlocks`, reports 236,656 source rows written, and reports 236,653 current Findings under `FINAL`
- [ ] Each ingested block produces no per-row events; a single `dataset-version-changed` event closes the ingest
- [ ] `ApplyChanges` with one upsert produces one `finding-upserted` entry in `dataset-events:{version}` whose payload validates against the shared schema
- [ ] `XLEN` never exceeds `DATASET_EVENTS_MAXLEN` by more than the approximate trim tolerance
- [ ] With `PRODUCER_SIMULATE_CHANGES_INTERVAL_MS=5000`, a new event appears within one interval; with the variable unset, none appear
- [ ] Producer memory stays flat during a full ingest
- [ ] No producer module exports a `StreamFindings` handler

## Blocked by

- T19 ClickHouse schema v2 and ingest mapping
- T23 Shared contracts and codegen

## Risks

- Emitting one `finding-upserted` per row during the initial ingest would flood
  the stream; the ingest path must publish only the version-changed event.
- `MAXLEN ~` trims approximately. The gateway (T22) must treat "id older than
  the first entry" as `resync-required`, not as an error.
- The simulator writes real rows. Keep it off by default and make it obvious in
  logs when it is running.
