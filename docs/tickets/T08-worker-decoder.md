# T08 Worker decoder and columnar index

> **Superseded** by [ADR-0001](../adr/0001-clickhouse-authoritative-query-engine.md).
> The browser no longer opens SSE in a worker, decodes protobuf, or builds a
> compact index. Reconnect without duplication is carried by
> [T22](T22-gateway-sse-change-relay.md) and [T25](T25-dashboard-data-layer.md);
> the spot-check against `finding(id)` is removed as a product decision recorded
> in the ADR. Content below is kept as history.

## Outcome

A dedicated browser Web Worker owns the SSE connection, decodes base64 protobuf
blocks, and accumulates the full 236,656-record corpus into a compact columnar
index built from typed arrays and string dictionaries, entirely off the main
thread.

## Scope

- A dedicated worker created through Vite's native worker support.
- `new EventSource('/api/stream')` opened **inside the worker**. `EventSource` is
  exposed in the worker global scope, so no client library is required.
- Per-frame pipeline: base64 decode to bytes, protobuf decode to `FindingBlock`,
  append columns into growable typed arrays.
- String handling via dictionary indices rather than per-record JavaScript
  strings, keeping heap far below the cost of decoded objects.
- Versioned worker message contracts defined in `packages/shared` and validated
  with `zod/mini` at the boundary, treating worker messages as untrusted input.
- Progress messages to the main thread reporting records ingested and total
  expected, so the UI can show real progress during load.
- Reconnect handling that lets `EventSource` resume via `Last-Event-ID` without
  duplicating already-indexed records.

## Acceptance criteria

- [ ] The worker ingests all 236,656 records and reports completion
- [ ] Spot-checked decoded values match the same records fetched through `finding(id)` in GraphQL
- [ ] The main thread remains responsive throughout ingest, with no long task attributable to decoding
- [ ] Index memory stays far below the cost of an equivalent array of decoded objects; record the measured figure
- [ ] Forcing a mid-stream disconnect results in a resumed stream with the correct final count
- [ ] Malformed or truncated frames are rejected explicitly rather than corrupting the index

## Blocked by

- T03 Proto contract and Buf codegen
- T06 Gateway SSE relay

## Risks

- Growable typed arrays require a doubling strategy; naive reallocation per block
  will dominate ingest time.
- The generated protobuf code must not pull Node-only imports into the worker
  bundle. T03 should have verified this.
- Progress messages posted too frequently become their own main-thread burden.
  Throttle them.
- This ticket establishes the index layout that T09 queries. Changing it later is
  expensive, so settle the column representation here.
