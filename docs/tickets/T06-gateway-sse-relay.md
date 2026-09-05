# T06 Gateway SSE relay

## Outcome

`apps/gateway` exposes a same-origin SSE endpoint that relays protobuf blocks
from Redis to browsers as base64 frames, giving the browser automatic reconnect
and resume without adding any client library.

This is the data plane. It never touches GraphQL or the Apollo cache.

## Scope

- Hono server with a `GET /api/stream` route returning `text/event-stream`.
- Subscribe to the Redis channel populated by T05 and emit one SSE frame per
  protobuf block, base64-encoded because SSE cannot carry binary.
- Set the SSE event id to the block sequence number so the browser's
  `Last-Event-ID` header drives resumption on reconnect.
- On reconnect with `Last-Event-ID`, resume from the next sequence rather than
  restarting the corpus.
- Correct streaming headers: no buffering, no compression that would defeat
  incremental delivery, and a keep-alive comment interval to survive idle proxies.
- Clean teardown of the Redis subscription when the client disconnects, verified
  under abrupt disconnects.
- `zod/mini` validation of query parameters and the `Last-Event-ID` value; reject
  malformed input explicitly.

## Acceptance criteria

- [ ] `curl -N http://localhost:PORT/api/stream` emits base64 `data:` frames with incrementing `id:` values
- [ ] Decoding a captured frame with the generated protobuf code yields a valid `FindingBlock`
- [ ] Disconnecting and reconnecting with `Last-Event-ID` resumes without duplicates or gaps
- [ ] Killing a client leaves no leaked Redis subscription or open handle
- [ ] Two concurrent clients each receive the full stream
- [ ] A malformed `Last-Event-ID` produces a clear error rather than undefined behavior

## Blocked by

- T05 Producer gRPC streaming service

## Risks

- Base64 inflates the payload by roughly a third. This is the accepted cost of
  SSE's built-in reconnect and resume semantics; do not silently switch the
  transport to `fetch` streaming without revisiting the decision.
- Proxies and dev servers frequently buffer `text/event-stream`. Verify against
  the real Vite dev proxy, not only `curl`.
- Per-connection Redis subscriptions do not scale; consider one shared
  subscription fanned out in-process, and note which approach was chosen.
