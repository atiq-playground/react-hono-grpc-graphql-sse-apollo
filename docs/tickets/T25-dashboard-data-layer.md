# T25 Dashboard data layer

## Outcome

The dashboard reads pages, facets, aggregates, and detail through Apollo Client
with cursor-aware cache policies, listens to `DatasetEvent`s on the main thread,
and keeps only live connection state in Zustand. The Web Worker, protobuf
decoding, and page-slice store are gone.

## Scope

- Apollo `typePolicies` in `apps/dashboard/src/app/providers.tsx` (or a new
  `apps/dashboard/src/graphql/cache.ts`): `findings` keyed by
  `["filters", "sort", "search", "timeRange", "analysisMode"]` with a cursor
  `merge` that appends edges and replaces `pageInfo`; `Finding` keyed by `id`.
- Typed hooks generated from T23 codegen: `useFindingsConnection`,
  `useFacets`, `useVulnerabilityOverview`, `useFinding`, `useDatasetInfo`,
  `useSearchSuggestions`.
- `apps/dashboard/src/features/live/use-dataset-events.ts`: main-thread
  `EventSource('/api/stream')`, each event decoded through
  `dataset-event-codec.ts` and validated; `Last-Event-ID` handled by the
  browser. Reactions:
  - `finding-upserted` writes the row with `cache.writeFragment`.
  - `finding-deleted`, `findings-changed`, `aggregates-invalidated`, and
    upserts that affect ordering trigger a debounced `refetchQueries` of the
    active `ExploreFindings`, `VulnerabilityOverview`, and `Facets` operations
    when the time range is `live`; in windowed modes they increment
    `pendingUpdates` instead.
  - `resync-required` calls `client.reFetchObservableQueries()`.
  - `export-ready` resolves the matching export job (T24).
- Shrink `apps/dashboard/src/state/dashboard-store.ts` to connection state,
  `lastEventId`, `pendingUpdates`, and bounded recent Finding-event state.
  Remove page-slice, query counters, and progress actions.
- Extend `apps/dashboard/src/app/url-state.ts`: `range`, `from`, `to`;
  `after` replaces `offset`; filters extended with `status`, `repo`, `group`,
  and `packageType`.
- Delete the legacy dashboard worker and harness; remove `@bufbuild/protobuf`,
  `@repo/proto`, and `redux` (if unused after the store shrink) from
  `apps/dashboard/package.json`.
- Update `apps/dashboard/src/app/route-loaders.ts` and
  `dashboard-context.tsx` to the new hooks and store shape.

## Implementation evidence and deviation (T31)

- The Apollo findings policy retains one canonical argument partition and caps
  it at 600 edges (three maximum 200-row pages), replacing the partition on a
  first-page refetch.
- Native `EventSource` opens app-wide on the main thread. It carries no initial
  dataset rows, but post-connect `finding-upserted` events do carry one bounded
  Finding Row.
- `lastEventId` is display/diagnostic state. Native EventSource supplies
  `Last-Event-ID` only during automatic reconnect of the current instance; the
  store cannot resume after a page reload.
- Cross-tab `BroadcastChannel` synchronization was not shipped. The store
  instead keeps a 100-entry recent Finding-event list used by detail/live
  presentation.

## Acceptance criteria

- [ ] Initial Explore data comes from bounded GraphQL requests; `/api/stream` carries only post-connect Dataset Events and never historical hydration
- [ ] `fetchMore` appends the next page in the cache without duplicating edges
- [ ] A `finding-upserted` event updates a visible row without a refetch when the time range is `live`
- [ ] In a windowed range the same event increments `pendingUpdates` and does not reorder rows
- [ ] `resync-required` refetches every active query once
- [ ] A malformed SSE payload is rejected and logged without breaking the connection
- [ ] The legacy dashboard query worker and harness no longer exist
- [ ] `apps/dashboard/package.json` lists neither `@bufbuild/protobuf` nor `@repo/proto`
- [ ] URL `?range=7d&after=<cursor>&status=open` round-trips through `url-state.ts`

## Blocked by

- T21 Gateway GraphQL query layer
- T22 Gateway SSE change relay
- T23 Shared contracts and codegen

## Risks

- `writeFragment` on a row whose sort key changed leaves it in the wrong
  position until refetch; the debounced refetch in `live` mode must cover
  this case.
- Debounce windows that are too short turn a burst into many refetches;
  align the client debounce with the gateway coalescing window.
- `redux` middleware removal changes devtools behavior; confirm the store
  still exposes named actions if the middleware stays.
