# T21 Gateway GraphQL query layer

## Outcome

The gateway answers every Finding Connection question the dashboard asks with a bounded
ClickHouse query: a keyset-cursor `findings` connection, facets that respect
active filters, the full overview aggregate list, record detail, search
suggestions, and dataset info. Nothing loads the corpus into Node.

## Scope

- Split `apps/gateway/src/graphql/` into modules: `findings-query.ts`,
  `findings-query.types.ts`, `cursor.ts`, `overview-query.ts`,
  `facets-query.ts`, `resolvers/*.ts`, and `schema.graphql`.
- Schema additions:
  - `findings(filters, sort, search, timeRange, analysisMode, after, first): FindingConnection`
    with `edges { cursor node { ...FindingRow } }`,
    `pageInfo { endCursor hasNextPage }`, and `totalCount`.
  - `finding(id: ID!)` where `id` is `findingId`.
  - `facets(filters, timeRange, analysisMode): Facets`.
  - `searchSuggestions(prefix: String!, limit: Int): [String!]!` using a
    bounded `DISTINCT ... LIMIT`.
  - `vulnerabilityOverview(filters, timeRange)` with `totals`,
    `severityDistribution`, `statusDistribution`, `byRepository`, `byImage`,
    `topPackages`, `riskFactorDistribution` (via `arrayJoin`), `ageBuckets`,
    `fixAvailability`, `cvesFoundVsFixed`, `timeToFixBuckets`, and
    `publishedTrend` (monthly).
  - `datasetInfo { version, totalCount, lastEventId }` replacing the legacy
    stream-bootstrap descriptor.
- Keyset cursor in `cursor.ts`: URL-safe JSON `{ s, id }`, zod-validated,
  compiled to `WHERE (sortCol, findingId) > ({s}, {id})`; `first` clamped to
  1 through `GRAPHQL_MAX_FIRST` (default 200).
- Query builder compiles filters into parameterized `WHERE` fragments from the
  shared field registry (T23). No string interpolation of identifiers;
  columns pass through an allowlist with `Identifier` parameters.
- `analysisMode` compiles to exact `kaiStatus != 'invalid - norisk'` or
  `!= 'ai-invalid-norisk'` predicates that keep null `kaiStatus` rows.
- `timeRange` compiles to a `publishedAt` window from the shared presets.
- All bounded queries use `FINAL` and `FORMAT JSONCompactEachRow`.
- Add `GRAPHQL_MAX_FIRST` to `apps/gateway/src/env.ts` and `.env.example`.
- Remove the legacy summary and stream-bootstrap resolvers and the
  `ensureProducerStream` fill in `apps/gateway/src/producer-client.ts`.

## Implementation evidence and deviation (T31)

- The gateway calls ClickHouse directly and maps positional
  `JSONCompactEachRow` tuples through declared output columns.
- `GRAPHQL_MAX_FIRST` is validated in the range 1-200. Page queries request one
  extra row to determine `hasNextPage`, while the Apollo cache separately caps
  retained edges.
- All current-row queries include `FINAL` and `isDeleted = 0`.
- `datasetInfo.totalCount` is the current Finding count, 236,653 after the
  canonical ingest, not the 236,656 Source Record count.

## Acceptance criteria

- [ ] `findings(first: 50)` returns at most 50 edges, a non-null `endCursor`, and `hasNextPage: true`; following `after` yields the next 50 with no overlap or gap
- [ ] A tampered or malformed `after` cursor is rejected with a GraphQL error, not a ClickHouse error
- [ ] `first: 1000` is clamped to `GRAPHQL_MAX_FIRST`
- [ ] `facets(filters: { severity: ["critical"] })` counts reflect only critical rows
- [ ] `analysisMode: ANALYSIS` excludes exactly `invalid - norisk` and keeps rows with null `kaiStatus`; the same holds for `AI_ANALYSIS` and `ai-invalid-norisk`
- [ ] `vulnerabilityOverview` totals reconcile with `SELECT count() FROM findings FINAL` for the same filters
- [ ] `finding(id)` returns source-preserving detail with blanks preserved as blanks
- [ ] `datasetInfo.totalCount` is 236,653 after a full ingest and `lastEventId` matches the Redis Stream tail
- [ ] No resolver, including export preparation, buffers more than one page in memory
- [ ] Every ClickHouse query uses bound parameters; no identifier or value is interpolated

## Blocked by

- T19 ClickHouse schema v2 and ingest mapping
- T23 Shared contracts and codegen

## Risks

- Keyset pagination requires a total order; every sort must append `findingId`
  as the tiebreaker or pages will drift.
- Sorting on nullable `publishedAt` needs an explicit `NULLS LAST` decision so
  the cursor comparison stays consistent.
- The overview aggregate list is long. Group queries so one request does not
  issue a dozen ClickHouse round trips without measuring latency first.
- `kaiStatus` exact matching includes the space in `invalid - norisk`.
