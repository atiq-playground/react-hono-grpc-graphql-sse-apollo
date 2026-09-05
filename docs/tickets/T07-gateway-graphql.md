# T07 Gateway GraphQL layer

> **Superseded in part** by
> [ADR-0001](../adr/0001-clickhouse-authoritative-query-engine.md) and
> [T21](T21-gateway-graphql-queries.md). The Apollo/Hono control-plane boundary
> survives; its original summary and stream-bootstrap schema does not. Content
> below is kept as history.

## Outcome

A single GraphQL schema on the Hono gateway aggregates what would otherwise be
several backend services, serving summaries, facets, record detail, and the
stream descriptor that bootstraps the SSE connection.

This is the control plane. Subscriptions are deliberately absent: the firehose
belongs to T06.

## Scope

- Apollo Server mounted at `/graphql` on the existing Hono app.
- Resolvers backed by ClickHouse aggregate queries, not by scanning rows in
  application code:
  - `summary`: total counts, severity distribution, and the counts backing the
    Analysis and AI Analysis views.
  - `facets`: distinct values with counts for the filterable attributes, used to
    populate filter controls.
  - `finding(id)`: full Record Detail for one Source Record, fetched lazily.
  - `streamDescriptor`: dataset version, total record count, and starting cursor,
    consumed by the worker to open the SSE connection.
- Analysis semantics exactly as defined in [CONTEXT.md](../CONTEXT.md): Analysis
  excludes records whose `kaiStatus` is exactly `invalid - norisk`; AI Analysis
  excludes exactly `ai-invalid-norisk`; records without `kaiStatus` remain
  included in both.
- GraphQL codegen producing typed operations for the client.
- `zod/mini` validation at the ClickHouse boundary; parameterized queries only.

## Acceptance criteria

- [ ] `summary` totals reconcile with direct ClickHouse counts, including 236,656 overall
- [ ] Analysis and AI Analysis counts exclude only the exact `kaiStatus` strings specified, leaving records without `kaiStatus` included
- [ ] `facets` returns distinct values with counts for every filterable attribute
- [ ] `finding(id)` returns source-preserving detail, with blank values preserved as blank
- [ ] `streamDescriptor` returns a cursor that T08 can successfully open a stream with
- [ ] No resolver loads the full corpus into application memory
- [ ] Generated client types compile against the schema

## Blocked by

- T01 Workspace foundation
- T04 Dataset ingest

## Risks

- Facet queries across 236,656 rows are cheap in ClickHouse but easy to write
  badly; confirm they run as aggregates rather than full materializations.
- The `kaiStatus` comparison is exact-match including the space in
  `invalid - norisk`. Trimming or normalizing it would silently change which
  records belong to a Result Set.
- Resist adding subscriptions here later. The architectural split is deliberate
  and documented in the plan.
