# T32 Final risk-based QA

## Outcome

Focused Jest, React Testing Library, and Playwright coverage exists for the
seams where the refactor carries the most risk: query compilation, cursor
encoding, event schemas, cache merging, the time range control, and the
end-to-end Explore journey. This is the only ticket in T18 through T32 that
writes tests, and there is no blanket coverage target.

## Scope

- Jest (node project):
  - `apps/gateway/src/graphql/findings-query.test.ts`: filters, search,
    `analysisMode`, and `timeRange` compile to parameterized SQL; identifiers
    pass only through the allowlist; `first` is clamped.
  - `apps/gateway/src/graphql/cursor.test.ts`: encode and decode round-trip,
    malformed and tampered cursors are rejected.
  - `packages/shared/src/dataset-events.test.ts` and
    `dataset-event-codec.test.ts`: every variant validates and round-trips;
    unknown types and missing versions fail.
  - `packages/shared/src/time-range.test.ts`: preset windows and `live`.
  - `apps/gateway/src/graphql/export/csv-escape.test.ts`: formula-injection
    prefixes and quoting.
- Jest (browser project):
  - `apps/dashboard/src/graphql/cache.test.ts`: `findings` cursor `merge`
    appends without duplicates and resets on key-arg change.
  - `apps/dashboard/src/features/live/use-dataset-events.test.tsx`:
    `finding-upserted` writes the fragment, windowed mode increments
    `pendingUpdates`, `resync-required` refetches.
  - React Testing Library for `TimeRange` (`packages/ui`) and
    `TimeRangeFilter` (dashboard): keyboard operation, `onChange` payloads,
    custom range popover focus.
- Playwright (`e2e/`): Explore journey against the running stack with the
  simulator on: load first page, apply a severity filter, scroll to trigger a
  second page, open a detail view, return with URL state intact; one check
  that no historical row stream or protobuf request reaches the browser.
- Record measured figures (first-page latency, overview latency, bundle size)
  in the test report or ticket comment; do not add a coverage threshold.

### Runtime reconciliation carried from T18-T31

- Ingest writes exactly 236,656 Source Records and reports 236,653 current
  Findings under `FINAL`; verify the three-identity-duplicate collapse and
  materialized date behavior.
- Exercise pagination overlap/gap behavior, input clamping/rejection, exact
  Analysis/AI Analysis semantics, facet and overview reconciliation, detail,
  and relevant ClickHouse query plans and latency.
- Exercise Redis retained replay, unavailable-id resync, burst coalescing,
  abrupt disconnect cleanup, identity-encoded SSE flushing through Vite, and
  GraphQL compression.
- Exercise simulator on/off behavior, producer bounds, and full-ingest memory.
- Exercise asynchronous export row/order/header/formula safety, streaming
  memory and cancellation, Redis expiry, download refusal, restart behavior,
  and residual local artifact behavior. `EXPORT_SYNC_ROW_LIMIT` does not select
  a synchronous path.
- Exercise the Apollo 600-edge cap and merge behavior, live/windowed updates,
  URL state, virtualized loading, keyboard/accessibility behavior, detail
  deletion, and browser-history versus direct-entry back navigation.
- Confirm the dashboard production bundle has no protobuf runtime and record
  the route and aggregate latency figures.

## Execution evidence (2026-09-05)

Deterministic coverage added in this gate:

- gateway Jest: opaque cursor validation, parameterized query compilation,
  nullable keysets and null-last ordering, `first` bounds, export formula and
  artifact boundaries, Redis replay positions, stream-id validation, and burst
  coalescing;
- shared Jest: all seven Dataset Event variants and codec rejection, UTC and
  custom Time Ranges, exact Analysis modes, and field/filter/sort registries;
- dashboard/UI Jest + RTL: Apollo partition merge/deduplication/600-edge cap,
  deterministic live/windowed/resync handling, keyboard preset selection,
  controlled custom states, and live announcements;
- Playwright: one mocked-boundary journey covering Overview, bounded Explore
  pages, cursor reset on filter/search/sort, windowed pending updates,
  keyboard-only custom Apply/Clear, export job/download, keyboard detail entry,
  response-size assertions, and absence of historical event payloads; one
  opt-in real-stack journey covers bounded pages, adjacent-page deduplication,
  keyboard time controls and detail entry, console errors, and overflow.

Observed command evidence:

- `bunx nx run-many -t test`: passed all six projects. Reported results were
  shared 26, producer 5, gateway 38, dashboard browser 30, and UI browser 9;
  `proto` has no tests. The dashboard browser target also discovers the nine
  UI tests, so those nine execute again under the explicit UI target.
- `bunx nx run-many -t typecheck`: passed all six projects.
- `bunx biome check .`: passed, 207 files checked.
- `bunx nx build dashboard`: passed. Entry JS is 479.00 kB raw /
  152.01 kB gzip, Explore is 123.81 / 37.29 kB, Overview is 396.13 /
  115.59 kB, Compare is 9.96 / 3.24 kB, and Detail is 9.33 / 3.23 kB.
  Built assets contain no
  `@bufbuild/protobuf`,
  `query-worker`, `finding-block`, or `Compact Index` strings.
- `bunx nx run dashboard:codegen`: passed.
- `bunx nx run proto:buf-generate` and `bunx buf lint packages/proto`: passed.
- `T32_REAL_STACK=1 LD_LIBRARY_PATH=/tmp/t32-playwright-libs/root/usr/lib/x86_64-linux-gnu bunx nx e2e dashboard`:
  four passed (mocked and real-stack journeys at desktop and 375×812).
- `LD_LIBRARY_PATH=/tmp/t32-playwright-libs/root/usr/lib/x86_64-linux-gnu bunx playwright test --workers=1`:
  the two deterministic journeys passed and the two opt-in real-stack cases
  skipped as designed.
- `git diff --check`: passed.
- the bounded streaming census passed with 45 groups, 740 repositories, 1,030
  images, and exactly 236,656 Source Records.

Runtime and browser evidence:

- Docker Desktop 4.89.0 was reachable outside the command sandbox; the existing
  ClickHouse 24.12.2.29 and Redis 7.4.2 containers were healthy. The
  user-owned producer/dashboard were preserved, and only a missing gateway was
  started temporarily for QA.
- the bounded source census reported 236,656 Source Records. Both ordinary and
  `FINAL` ClickHouse counts were 236,653 after background
  `ReplacingMergeTree` merging; `fixedAt` had 2,894 nulls and `publishedAt`
  had none. The three-record source-to-Finding collapse is therefore present,
  but the pre-merge physical insert count is no longer recoverable from this
  settled table.
- GraphQL page 1 and page 2 each returned 50 edges in 14.1 kB with zero
  duplicate IDs (47.5 ms and 34.0 ms). A severity/search/Analysis request
  returned 25 of 41,502 in 7.3 kB / 32.7 ms; `first: 10000` clamped to 200
  edges in 55.9 kB / 36.2 ms; `first: 0` returned `Invalid findings
  arguments`; detail was 942 bytes / 58.6 ms.
- Overview was 8.4 kB / 94.2 ms and facets were 36.4 kB / 116.8 ms. GraphQL
  totals (236,653 total, 219,607 Analysis, 224,694 AI Analysis) exactly matched
  direct ClickHouse counts. A constructed valid nullable-`fixedAt` cursor
  returned the next null row in 442 bytes / 26.3 ms.
- real SSE verified fresh-tail delivery, exclusive `Last-Event-ID` replay,
  missing retained-ID `resync-required`, and 101 deletes coalesced into one
  aggregate invalidation plus one 101-ID change event. Headers were
  `text/event-stream`, `Content-Encoding: identity`, `Cache-Control: no-cache`,
  and `X-Accel-Buffering: no`. All injected stream entries were deleted.
- a one-row export reached `READY`, had a 3,600-second Redis TTL, emitted one
  `export-ready` event, and downloaded through the dashboard proxy in 3.7 ms
  as a 314-byte CSV. Headers included attachment disposition, private
  no-store caching, and `nosniff`; parsed output had zero formula-leading
  cells. Its Redis job, stream event, and artifact were removed.
- both browser journeys passed at desktop and 375×812. The real journey
  observed 50-edge bounded GraphQL, no adjacent-page overlap, keyboard time
  selection and detail entry, semantic landmarks, no document-level
  horizontal overflow, and zero console errors. The deterministic journey
  additionally completed custom date Apply/Clear entirely by keyboard and
  asserted no GraphQL response exceeded 100 kB.

Environment remediation and remaining runtime scope:

- `ldd` found only `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, and
  `libasound.so.2` missing. `sudo -n true` returned
  `sudo: a password is required`. Without system changes, Ubuntu packages
  `libnspr4`, `libnss3`, and `libasound2t64` were downloaded and extracted
  under `/tmp/t32-playwright-libs`; `ldd` then reported no missing libraries.
  The temporary libraries were removed after QA.
- destructive re-ingest, simulator mutation, full-ingest memory profiling,
  exhaustive pagination gap proof, query-plan capture, SSE trim-at-MAXLEN and
  connection-leak measurement, GraphQL compression, export cancellation /
  restart / actual TTL expiry, automated accessibility scanning, and all
  loading/empty/error/history/deleted-detail states remain outside this pass.
- Bare `bun test` invokes Bun's built-in test discovery in this workspace and
  incorrectly collects Playwright/jsdom specs; the configured repository test
  command is `bun run test` / `bunx nx run-many -t test`, which passed.

Defects fixed during QA:

- Explore search now uses the gateway's 256-character bound instead of
  allowing 512 characters in either the input or URL parser.
- Vite now proxies `/api/exports` to the gateway; before the fix, same-origin
  downloads returned the dashboard HTML/JSON fallback instead of CSV.
- the deterministic EventSource test dispatches to the current StrictMode
  instance rather than the disposed first instance.
- the browser test setup supplies writable `ResizeObserver` and
  `scrollIntoView` jsdom boundaries, and the searchable Combobox gives cmdk an
  explicit accessible label.
- the Compare route test uses typed `jest.requireActual` instead of an
  untyped CommonJS `require`.
- the producer protobuf-shape test now expects the shipped v2 type names.
- browser Jest resolves source `.js` specifiers and leaves shared contract
  tests to the node project.

## Acceptance criteria

- [x] `bunx nx run-many -t test` passes with the listed Jest and RTL specs present
- [x] `bunx nx e2e dashboard` runs the Explore journey against `bun dev` and passes
- [x] The query builder tests demonstrate that no identifier or value reaches SQL unparameterized
- [x] Cursor tests reject a cursor whose `id` or `s` field has been altered
- [x] `DatasetEvent` schema tests cover all seven event types plus the unknown-type rejection
- [x] Apollo merge tests show no duplicate edges across two `fetchMore` calls
- [x] The RTL `TimeRange` spec is operable entirely from the keyboard
- [x] No test reads `ui_demo.json`; fixtures are small and sanitized
- [x] Measured latency and bundle figures are recorded alongside the results

Acceptance count: 9 of 9 ticket checks have direct evidence. T32 remains in
progress because the residual runtime scope above was intentionally not
converted into a pass.

## Dependency

- T31 Documentation rewrite for the shipped architecture was complete before
  this QA pass began.

## Risks

- Playwright depends on Docker, ClickHouse with data, Redis, and all three
  apps running; the `webServer` hook in `playwright.config.ts` must boot them
  or the spec must skip with a clear message.
- Source inspection in T31 does not satisfy these runtime criteria. Keep
  failures or unavailable infrastructure explicit; do not convert an
  unavailable check into a pass.
- Testing the live hook needs a controllable `EventSource`; use a small mock
  rather than a real connection.
- Risk-based scope invites scope creep. Test the listed seams and stop; add a
  seam only with a stated risk it reduces.
