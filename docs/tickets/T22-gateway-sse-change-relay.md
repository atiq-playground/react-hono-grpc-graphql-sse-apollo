# T22 Gateway SSE change relay

## Outcome

`GET /api/stream` relays `DatasetEvent`s from the Redis Stream to browsers as
plain-text SSE, replays missed events from `Last-Event-ID`, tells the client to
resync when the requested position has been trimmed, and coalesces bursts into
a single invalidation instead of forwarding every upsert.

## Scope

- Rewrite `apps/gateway/src/sse.ts` to read `dataset-events:{version}` with
  `XREAD`: on connect with `Last-Event-ID`, replay from that id, then
  `XREAD BLOCK` for new entries. SSE `id` is the Redis entry id.
- If `Last-Event-ID` is older than the first entry in the stream (or the
  stream was recreated), emit a `resync-required` event before continuing
  from `$`.
- Emit named SSE events matching the shared `DatasetEvent` schema (T23):
  `finding-upserted`, `finding-deleted`, `findings-changed`,
  `aggregates-invalidated`, `dataset-version-changed`, `export-ready`,
  `resync-required`, plus a `keepalive` comment on an interval.
- Coalescing: when more than `DATASET_EVENTS_COALESCE_THRESHOLD` events arrive
  within `DATASET_EVENTS_COALESCE_WINDOW_MS`, emit one
  `findings-changed { ids[] }` (or `aggregates-invalidated`) for the window
  instead of N upserts.
- Validate `Last-Event-ID` and query parameters with `zod/mini`; reject
  malformed input explicitly.
- Enable response compression for `/graphql`. Keep `/api/stream`
  identity-encoded unless the chosen middleware exposes explicit per-event
  flushing; no buffering may delay frames.
- Add `DATASET_EVENTS_STREAM`, `DATASET_EVENTS_COALESCE_WINDOW_MS`, and
  `DATASET_EVENTS_COALESCE_THRESHOLD` to `apps/gateway/src/env.ts` and
  `.env.example`; remove `REDIS_STREAM` and `PRODUCER_URL`.
- Delete the legacy encoded bulk-row frame path and gateway producer client.

## Implementation evidence and deviation (T31)

- The shipped Hono compression middleware cannot explicitly flush each SSE
  frame. The route therefore sets `Content-Encoding: identity`,
  `Cache-Control: no-cache, no-transform`, and `X-Accel-Buffering: no`.
  GraphQL retains compression middleware.
- Each client currently owns one blocking Redis connection. This is the
  deliberate local-scale implementation, with shared in-process fan-out
  deferred until measured connection pressure warrants it.
- Burst coalescing may emit both `aggregates-invalidated` and
  `findings-changed`; neither carries historical rows.

## Acceptance criteria

- [ ] `curl -N http://localhost:4000/api/stream` emits text `event:`/`data:` frames with `id:` set to Redis entry ids; no frame carries encoded bulk rows
- [ ] Reconnecting with `Last-Event-ID` set to a mid-stream id replays exactly the later entries and then continues live
- [ ] Reconnecting with an id older than the stream head yields a `resync-required` event first
- [ ] Publishing more than the threshold within one window produces one `findings-changed` event listing the affected ids rather than N `finding-upserted` events
- [ ] A malformed `Last-Event-ID` returns a 400 with a clear message
- [ ] Killing a client leaves no leaked Redis connection or blocked `XREAD`
- [ ] `/graphql` responses carry `Content-Encoding` when the client accepts it, and identity-encoded SSE frames still arrive without delay through the Vite dev proxy
- [ ] No gateway module imports `@repo/proto`

## Blocked by

- T20 Producer ingestion and change publisher
- T23 Shared contracts and codegen

## Risks

- A blocked `XREAD` per client connection does not scale; consider one shared
  reader fanned out in-process and record the choice.
- SSE middleware buffering is avoided by identity encoding. T32 must still
  verify incremental delivery through the real Vite proxy, not only `curl`.
- Coalescing changes what the client sees. Document that `findings-changed`
  carries ids only and the client refetches; do not smuggle row payloads into
  it.
