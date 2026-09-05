---
status: proposed
date: 2026-09-05
---

# Binary live transport is deferred, not rejected

[ADR-0001](0001-clickhouse-authoritative-query-engine.md) ships the live
channel as SSE carrying JSON `DatasetEvent`s relayed from a Redis Stream. A
binary alternative was evaluated and is explicitly deferred: no code is built
for it now, and this record exists so the option is revisited on measured
evidence rather than re-argued from scratch.

## Option

Replace or supplement SSE with either a WebSocket carrying binary frames or a
`fetch` response consumed as a `ReadableStream` of length-prefixed frames. Both
carry raw protobuf `DatasetEvent` messages from `packages/proto`, decoded
client-side with `@bufbuild/protobuf`. No base64 anywhere.

## Benefits

- Smaller per-event bytes, because protobuf field tags and varints replace
  repeated JSON keys and quoted strings (roughly 150 B versus 400 B raw for a
  `finding-upserted`), and because a binary transport needs no base64 wrapper.
  SSE would add about 33 percent and defeat compression.
- Lower per-event parse cost at high rates, because protobuf decoding into
  typed messages avoids `JSON.parse` string allocation and can be moved to a
  Web Worker with transferable `ArrayBuffer`s.
- Batching for free, because a single frame can carry a repeated
  `DatasetEvent` list, so one network read yields N events. Coalescing becomes
  a transport property rather than a relay heuristic.
- Bidirectional control on WebSocket, because the client can send subscription
  scope changes (active filters, dataset version) without reconnecting, so the
  server filters fan-out to exactly what the view needs.
- One schema for server and client, because the same `packages/proto`
  `DatasetEvent` definition drives the producer, Redis payloads, and the
  browser decoder.

## Costs, and why not now

- Roughly 30 to 50 KB of extra client JavaScript (`@bufbuild/protobuf` plus
  generated code) shipped to every user.
- A second schema for the same shape GraphQL already defines.
- `EventSource` reconnect and `Last-Event-ID` semantics must be re-implemented
  by hand on either transport.
- `docs/RULES.md` and the current product prompt fix SSE as the live transport.
- The configured local simulator and relay coalescing do not establish a
  sustained high-rate workload. T32 must record measured traffic before this
  option is reconsidered, so the bundle and protocol complexity are not
  justified today.

## Trigger to revisit

Measured, not assumed:

- Sustained per-client live traffic above roughly 10 payload-carrying events
  per second, or 20 KB/s, after coalescing. The shipped SSE route is
  identity-encoded to preserve incremental flushing.
- A product surface that needs it: live tail or SOC wallboard, metered or
  mobile clients.

## Design sketch for later

- `DatasetEvent` and `DatasetEventBatch` messages in `packages/proto`.
- Gateway `GET /api/stream` negotiates `Accept: application/x-protobuf` for
  the fetch stream, or a `/api/ws` upgrade for WebSocket.
- The same `useDatasetEvents` hook with a transport strategy selected behind
  `dataset-event-codec.ts`, which is why JSON encode/decode is isolated there
  in T23.
- Decode in a Web Worker only if profiling shows main-thread cost.
- Scope messages `subscribe { datasetVersion, filters }` on WebSocket.
