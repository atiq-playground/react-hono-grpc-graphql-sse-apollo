# T09 Worker query engine

> **Superseded** by [ADR-0001](../adr/0001-clickhouse-authoritative-query-engine.md).
> Filtering, sorting, search suggestions, pagination, and exact `kaiStatus`
> semantics move to the ClickHouse-backed GraphQL layer in
> [T21](T21-gateway-graphql-queries.md); CSV export in current sort order moves
> to the server-side export job in [T24](T24-server-side-export.md). Content
> below is kept as history.

## Outcome

The worker answers filter, sort, search, pagination, and export requests against
the columnar index, returning only the slice the UI needs. No query work ever
runs on the render thread.

## Scope

- Filtering across the source-provided Vulnerability Attributes, operating on
  dictionary indices rather than string comparison where possible.
- Sorting that produces an index permutation instead of reordering the underlying
  columns.
- Search with suggestions, scoped to the attributes that make sense for lookup
  (CVE, package name, image, repository).
- Pagination returning a hydrated page slice: only the visible rows are
  materialized into objects and posted to the main thread.
- Result Set semantics per [CONTEXT.md](../CONTEXT.md), including the Analysis and
  AI Analysis exclusions applied as ordinary predicates.
- CSV export computed in the worker over the full Result Set, not just the
  current page, streamed back so a large export does not spike memory.
- Query requests and responses validated at the worker boundary with `zod/mini`.

## Acceptance criteria

- [ ] Filter and sort results match equivalent ClickHouse queries for several non-trivial combinations
- [ ] Filtering the full 236,656-record index completes fast enough to feel immediate; record the measured timing
- [ ] Sorting does not mutate the underlying column arrays
- [ ] A page request returns only the requested slice, not the full Result Set
- [ ] Analysis and AI Analysis filters exclude only the exact `kaiStatus` values, keeping records without `kaiStatus`
- [ ] CSV export covers the entire Result Set in current sort order and escapes correctly
- [ ] Concurrent or superseded queries are cancelled rather than racing to update the UI

## Blocked by

- T08 Worker decoder and columnar index

## Risks

- Export over the full Result Set is the largest single allocation in the browser;
  stream it in chunks rather than building one string.
- Rapid filter typing will queue queries. Supersede in-flight work instead of
  serializing it.
- Sorting by a dictionary-encoded column sorts by index, which is not lexical
  order. Sort the dictionary once and map through it.
