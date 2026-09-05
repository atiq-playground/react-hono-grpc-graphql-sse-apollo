# T05 Producer gRPC streaming service

## Outcome

`apps/producer` serves the findings corpus over gRPC server-streaming, reading
ClickHouse with a streaming cursor and framing results as columnar protobuf
blocks, while publishing the same blocks to Redis for cross-replica fan-out.

The hot path performs no JSON parsing and no transcoding: read block, frame,
send.

## Scope

- A `DataLakeSource` implementation over `@clickhouse/client` issuing
  `SELECT ... FORMAT RowBinaryWithNamesAndTypes` (or Native) and consuming the
  result as a stream rather than buffering.
- Translation from ClickHouse result blocks into `FindingBlock` messages,
  building the per-stream string dictionary as values are first encountered.
- The `StreamFindings` RPC honoring the request cursor so a client can resume
  from a block sequence number.
- Redis publication of each encoded block, keyed by dataset version, so multiple
  gateway replicas can fan out without each opening its own ClickHouse stream.
- Backpressure: respect the gRPC stream's writable state instead of queueing
  blocks without bound.
- Graceful shutdown closing the ClickHouse cursor and Redis connection.

## Acceptance criteria

- [ ] A gRPC client receives all 236,656 findings across successive blocks and the stream terminates cleanly
- [ ] Decoded block contents match a ClickHouse `SELECT` for the same cursor range
- [ ] Resuming from a mid-stream sequence number yields exactly the remaining records with no duplicates or gaps
- [ ] Every published block also appears on the Redis channel
- [ ] Producer memory stays flat while streaming the full corpus, confirming no buffering
- [ ] A slow consumer causes the producer to slow down rather than grow unboundedly

## Blocked by

- T03 Proto contract and Buf codegen
- T04 Dataset ingest

## Risks

- If Bun's http2 server proves unreliable for gRPC serving, switch this project's
  Nx target to Node v24.19.0. T03 should have surfaced this already.
- Block size is a real tuning decision: too small wastes framing overhead, too
  large adds latency to first paint in the browser. Pick a starting size and
  record the rationale.
- The string dictionary is per-stream state, so a resumed stream must either
  resend the dictionary or negotiate what the client already holds. Decide
  explicitly and document it.
