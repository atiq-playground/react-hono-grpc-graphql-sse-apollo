# T23 Shared contracts and GraphQL codegen

## Outcome

`packages/shared` holds one isomorphic definition of the finding fields, time
range presets, analysis mode constants, and `DatasetEvent` schemas that the
producer, gateway, and dashboard all import. The dashboard generates its
GraphQL types from the gateway schema file instead of maintaining them by hand.

## Scope

- `packages/shared/src/finding-fields.ts`: a single registry of finding fields
  with group membership (`explore`, `detail`, `filterable`, `sortable`,
  `searchable`). It drives GraphQL selection sets, the SSE upsert schema, grid
  columns, CSV columns, and gateway allowlists.
- `packages/shared/src/time-range.ts`: presets
  `live | 24h | 7d | 30d | 1y | 5y | custom` with `toInterval()` returning a
  `publishedAt` window (or none for `live`), plus zod schemas for URL and
  GraphQL input.
- `packages/shared/src/dataset-events.ts`: `zod/mini` schemas for
  `finding-upserted`, `finding-deleted`, `findings-changed`,
  `aggregates-invalidated`, `dataset-version-changed`, `export-ready`, and
  `resync-required`, as a discriminated union with an explicit version field.
- `packages/shared/src/dataset-event-codec.ts`: JSON encode and decode
  isolated behind one module so a binary transport (ADR-0002) can be added
  behind the same interface later.
- `packages/shared/src/analysis-mode.ts`: exact `kaiStatus` constants
  `invalid - norisk` and `ai-invalid-norisk` and the `all | analysis | aiAnalysis`
  mode union.
- Delete the legacy shared browser-worker protocol module and its exports.
- `apps/dashboard/codegen.ts` using the existing `@graphql-codegen` packages,
  reading `apps/gateway/src/graphql/schema.graphql` from disk at build time
  (no runtime server import). Generated output replaces the hand-maintained
  `apps/dashboard/src/graphql/generated.ts`; add an Nx `codegen` target.
- `packages/shared` keeps zero server dependencies (no `@clickhouse/client`,
  `redis`, or `@repo/proto`).

## Implementation evidence (T31)

- The shared package has only `zod` as a runtime dependency and exports the
  field registry, filter/sort/cursor contracts, Time Range, analysis constants,
  Dataset Event schemas/codec, and ClickHouse date conversion.
- GraphQL Code Generator reads the checked-in gateway schema and dashboard
  operations without starting the gateway and writes the generated client
  directory under `apps/dashboard/src/graphql/`.

## Acceptance criteria

- [ ] `packages/shared` typechecks and exports the registry, time range, dataset event, codec, and analysis mode modules
- [ ] The legacy shared browser-worker protocol module no longer exists and nothing imports it
- [ ] Every `DatasetEvent` variant round-trips through `dataset-event-codec.ts` and an unknown `type` is rejected
- [ ] `toInterval("7d")` yields a window ending now and starting seven days earlier; `toInterval("live")` yields no window
- [ ] `bunx nx run dashboard:codegen` regenerates types from the schema file without starting the gateway
- [ ] The dashboard typechecks against the generated types
- [ ] `packages/shared/package.json` lists no server-only dependency

## Blocked by

None.

## Risks

- The field registry is shared by five consumers; a field added without a group
  silently disappears from one of them. Make groups explicit and exhaustive.
- Codegen runs against the schema file, which T21 rewrites. Until T21 lands,
  generate against the current schema and expect a second run.
- `packages/shared` must stay importable from the browser bundle; a stray
  Node import breaks the dashboard build.
