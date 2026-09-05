# T14 Sentry distributed tracing

## Outcome

A single trace follows a request across all three processes, so a slow or failed
stream can be attributed to the producer, the gateway, or the browser rather than
guessed at.

## Scope

- Sentry initialized in `apps/dashboard` (browser SDK with React integration),
  `apps/gateway`, and `apps/producer`.
- Trace context propagated across both non-HTTP hops:
  - Gateway to producer through **gRPC metadata** carrying `sentry-trace` and
    `baggage`.
  - Gateway to browser through a trace field on the **SSE stream envelope**, since
    SSE frames carry no headers of their own.
  - Browser worker to main thread preserved across the `postMessage` boundary.
- Spans covering the meaningful segments: ClickHouse query, gRPC stream duration,
  SSE relay, worker decode, and worker query execution.
- Source maps uploaded for the dashboard build so browser stack traces are
  readable.
- Configuration driven entirely by environment variables, with the SDK disabled
  cleanly and silently when no DSN is present.
- No dataset contents, credentials, or personal data attached to events; scrub
  before send.

## Acceptance criteria

- [ ] A single trace spans browser, gateway, and producer for one stream session
- [ ] A deliberately failed ClickHouse query surfaces in Sentry with the originating browser trace attached
- [ ] Worker errors are reported with useful stack frames rather than anonymous worker context
- [ ] With no DSN configured, all three processes start and run normally with no errors or warnings
- [ ] No finding contents or connection credentials appear in any captured event
- [ ] Dashboard stack traces resolve to original sources via uploaded source maps

## Blocked by

- T05 Producer gRPC streaming service
- T06 Gateway SSE relay
- T11 Dashboard shell and routing

## Risks

- Tracing every SSE frame would generate enormous span volume. Trace the stream
  session and sample within it rather than instrumenting per frame.
- Propagating trace context through the SSE envelope means touching the frame
  format defined in T06; coordinate rather than forking the format.
- Performance instrumentation can itself add main-thread work. Verify the ingest
  timings from T08 do not regress once tracing is enabled.
