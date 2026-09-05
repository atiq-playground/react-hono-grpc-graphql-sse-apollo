---
status: accepted
date: 2026-09-05
---

# ClickHouse is the authoritative query engine

The first vertical slice (T05, T06, T08, T09, T10, T12) streamed the complete
236,656-record corpus from the producer over gRPC, Redis, and base64 SSE frames
into a browser Web Worker that decoded protobuf `FindingBlock`s into a Compact
Index and answered every filter, sort, search, pagination, and export request
client-side. That model duplicates the warehouse in every browser tab, ties
first paint to a full-corpus download, and makes the browser the only place
that can answer questions ClickHouse already answers in milliseconds.

We decided: **ClickHouse is the authoritative query engine for filtering,
sorting, searching, faceting, aggregation, and pagination. The browser
maintains only bounded query results (Apollo Client cache) and incremental live
state. SSE communicates post-connection changes or invalidation signals, backed
by a Redis Stream for catch-up, rather than hydrating the complete historical
dataset. gRPC/protobuf remains a server-to-server ingestion contract only; the
browser never decodes protobuf.**

## Shape of the decision

- `apps/producer` is repurposed as the ingestion and change-publisher service.
  It receives `FindingBlock`s over gRPC (`IngestBlocks` / `ApplyChanges`),
  writes ClickHouse, and `XADD`s JSON `DatasetEvent`s to a Redis Stream.
  `packages/proto` stays server-only.
- `apps/gateway` serves bounded GraphQL queries on ClickHouse: a keyset-cursor
  `findings` connection, `facets`, `vulnerabilityOverview` aggregates,
  `finding(id)`, `searchSuggestions`, `datasetInfo`, and a server-side export
  job (`createExport` / `exportJob`). It relays `DatasetEvent`s over
  `GET /api/stream` using the Redis entry id as the SSE `id`, replays from
  `Last-Event-ID`, and emits `resync-required` when the requested id has been
  trimmed.
- `apps/dashboard` fetches pages with Apollo Client (`fetchMore` under TanStack
  Virtual), applies live upserts through the Apollo cache, and keeps only
  connection state, `lastEventId`, `pendingUpdates`, and a bounded recent-event
  list in Zustand. No Web Worker, no `@bufbuild/protobuf`, no `@repo/proto`.
- Time-range presets (`live | 24h | 7d | 30d | 1y | 5y | custom`) filter on the
  CVE `published` attribute, materialized as `publishedAt`. **Live** means no
  window plus SSE updates applied in real time with a live ticker. Non-Live
  windows show an "N updates - Refresh" affordance instead of reordering rows
  under the user.
- Relay-side coalescing is the scale posture: above a configured threshold the
  gateway emits one `findings-changed { ids[] }` or `aggregates-invalidated`
  per window and the client performs one bounded refetch. Events are
  notifications about data, not a data transport.

## Implementation clarification (T31)

- Current Finding identity is `(group, repo, image, cve, packageName,
  packageVersion, path)`. The source has 236,656 rows and three duplicate
  identity tuples, so `SELECT count() FROM findings FINAL` returns 236,653
  current Findings after canonical ingest.
- Bounded ClickHouse result queries use `JSONCompactEachRow`.
- GraphQL responses may be compressed. SSE is identity-encoded because the
  shipped Hono middleware cannot explicitly flush each event.
- Export jobs are always asynchronous and write local gateway artifacts.
- Cross-tab live-state synchronization was not implemented.

## Considered options

- **Keep the full-corpus Compact Index in the worker.** Rejected: every tab
  pays the whole download and memory cost before the first useful query, the
  index duplicates ClickHouse capability in a second implementation, and live
  updates require re-streaming or patching a client-side columnar store.
- **Hybrid: worker index for the current Result Set, ClickHouse for the rest.**
  Rejected: two query engines with two sets of semantics for the same filters,
  and the worker still needs a bulk transport.
- **GraphQL subscriptions for live changes.** Rejected: the control-plane /
  data-plane split in `docs/RULES.md` stands; SSE with `Last-Event-ID` gives
  reconnect and replay without a client library.
- **Binary live transport (WebSocket or fetch stream + protobuf).** Deferred,
  not rejected; see [ADR-0002](0002-binary-live-transport-deferred.md).

## Requirement classification

Every requirement that previously depended on the full Compact Index falls into
one of three groups.

### Still required, with a server equivalent

| Requirement (origin) | Server equivalent |
| --- | --- |
| Filter, sort, search, paginate the Result Set (T09, T12) | `findings(filters, sort, search, timeRange, analysisMode, after, first)` keyset-cursor connection on ClickHouse (T21) |
| Search suggestions (T09) | `searchSuggestions(prefix, limit)` bounded `DISTINCT ... LIMIT` (T21) |
| Analysis / AI Analysis exact `kaiStatus` semantics (T09) | `analysisMode` argument compiled to exact `!=` predicates server-side (T21, T23) |
| CSV export in current sort order (T09, T12) | Server-side export job streaming ClickHouse `FORMAT CSVWithNames` to an artifact (T24) |
| Facets (T07) | `facets(filters, timeRange, analysisMode)` respecting active filters (T21) |
| Overview aggregates (T13) | `vulnerabilityOverview(filters, timeRange)` extended to the full chart list (T21, T28) |
| Reconnect without duplication (T08) | Redis Stream entry id as `Last-Event-ID`; `resync-required` when trimmed (T22, T25) |
| Grid virtualization, only visible rows in the DOM (T12) | TanStack Virtual over Apollo pages with `fetchMore` (T27) |

### Obsolete

- Worker owns SSE, decodes protobuf, and accumulates 236,656 records (T08).
- Worker filters the full index (T09).
- "Index memory far below decoded objects" (T08).
- "Sorting reorders the full Result Set client-side" (T12).
- `streamDescriptor.totalRecords` and `streamDescriptor.redisStream` (T07);
  replaced by `datasetInfo { version, totalCount, lastEventId }`.
- Base64 `finding-block` SSE frames (T06).
- Producer full-corpus `StreamFindings` RPC (T05).
- `ensureProducerStream` gateway-to-producer fill (T06).
- Dashboard dependencies `@bufbuild/protobuf` and `@repo/proto`.
- `apps/dashboard/scripts/worker-harness.ts`.
- Zustand page-slice state (T10).

### Product decisions before removal

Documented here so they are not silently dropped:

- "Grid usable while the stream is still ingesting" (T12) is replaced by "grid
  usable while the dataset is changing (Live)". The initial load no longer has
  an ingest phase in the browser.
- "Spot-check decoded values against `finding(id)`" (T08) is removed. There is
  no client decode path to compare against.
- Cross-tab `BroadcastChannel` sync (T10) is kept only for live-status
  (connection state and pending updates), not for search or filter state.

## Consequences

- `docs/RULES.md`, `AGENTS.md`, and `.cursor/rules/**` clauses that made the
  worker the query owner are rewritten in T18; the full documentation rewrite
  (CONTEXT vocabulary, TECH_STACK, STRUCTURE, README) lands in T31.
- The ClickHouse `findings` table becomes `ReplacingMergeTree` with an identity
  key and `findingId`, which requires `ingest --force` (T19).
- "Never perform heavy query transforms on the React render thread" remains a
  principle. What changes is where the work goes: ClickHouse, not a worker.
- Tickets T05, T06, T08, T09, T10, and T12 carry a supersession note and remain
  in the tree as history.
