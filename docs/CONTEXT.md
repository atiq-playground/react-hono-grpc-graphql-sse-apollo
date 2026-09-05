# Security Vulnerability Dashboard

Settled domain vocabulary for the shipped ClickHouse-authoritative dashboard.

## Data and identity

**Source Dataset**

The complete supplied JSON corpus used to produce one dashboard dataset
version. It is untrusted source evidence and remains untracked.

**Source Record**

One vulnerability object as it occurs in the source hierarchy. The bounded
ingest census found exactly **236,656 Source Records**. Separate occurrences
remain separate Source Records even when their current Finding identity is the
same.
_Avoid_: Finding, CVE, current row

**Source Context**

The source-provided group, repository, image, and package context around a
Source Record. Blank values are preserved rather than inferred.

**Affected Package**

The package named by a Source Record. Package name, package version, and path
all participate in current Finding identity.

**CVE**

A non-unique vulnerability attribute. One CVE may appear in many Findings and
is never the Finding identifier.

**Finding**

The current logical vulnerability occurrence identified by:

`(group, repo, image, cve, packageName, packageVersion, path)`

ClickHouse derives `findingId` from that tuple. The 236,656 Source Records
contain three duplicate identity tuples; `ReplacingMergeTree` plus `FINAL`
collapses them, so a freshly ingested dataset has **236,653 authoritative
current Findings**. The duplicate records differ in non-identity advisory
attributes. A Finding is not a CVE and is not a claim of identity across
Dataset Versions.

**Dataset Version**

An immutable identifier for one source ingest and its live-event namespace. It
is not renamed or reused for another corpus. Current Finding state may advance
within that namespace through newer ClickHouse row versions and append-only
Redis events; consumers never rewrite prior events or infer cross-version
Finding identity.

## Query and presentation

**Finding Row**

The bounded Explore representation returned on a `FindingConnection` edge and
carried by a `finding-upserted` event. It contains only row-level fields needed
by the grid, not the full source-preserving record.
_Avoid_: Finding Detail, complete Source Record

**Finding Detail**

The full selected representation returned by `finding(id)`, including package
location, narrative, advisory, dates, arrays, and current update metadata.
_Avoid_: CVE detail, Finding Row

**Finding Connection**

The bounded GraphQL result of `findings(...)`: ordered `edges`, `pageInfo`, and
the authoritative `totalCount` for the active query.

**Finding Edge**

One `Finding Row` paired with the cursor for that exact position in the active
sort order.

**Cursor**

An opaque, validated URL-safe keyset-pagination token containing the current
sort value and `findingId` tiebreaker. The browser stores it in the `after` URL
parameter and must not edit or interpret it.
_Avoid_: Redis Stream ID, offset

**Time Range**

A filter over ClickHouse `publishedAt`, materialized from the source
`published` string. Presets are `live`, `24h`, `7d`, `30d`, `1y`, `5y`, and
`custom`. Rolling presets resolve to an absolute start and end at request time;
custom requires validated ISO `from` and `to` values.

**Live**

The unbounded Time Range: no `publishedAt` window plus current
`DatasetEvent`s. In Live mode, the client updates normalized rows and performs
bounded refetches. In windowed modes, data-change events increment a pending
count until the user refreshes.

**Aggregate**

A bounded ClickHouse result that summarizes the current query domain, such as
totals, distributions, top entities, age or fix buckets, and published trend.
The browser renders aggregates; it does not derive them from loaded pages.

**Facet**

A ClickHouse-computed value/count list used to populate filters. Facets respect
the active filters, Time Range, and Analysis mode supplied to the operation.

**Compare**

A two-sided view of Analysis modes over one filter and Time Range domain.
Each side applies that mode's exact `kaiStatus` exclusion.
_Avoid_: Finding pair, Dataset Version diff, time-range A/B

**Export Job**

An asynchronous gateway task created through GraphQL. Redis stores expiring job
metadata; ClickHouse streams spreadsheet-safe `CSVWithNames` output to a local
gateway artifact; `/api/exports/:id` serves it when ready. Local disk makes this
a single-node playground boundary, not durable shared storage.

## Live transport

**Dataset Event**

A versioned JSON notification published by the producer to a Redis Stream and
relayed by the gateway over SSE. Current variants are `finding-upserted`,
`finding-deleted`, `findings-changed`, `aggregates-invalidated`,
`dataset-version-changed`, `export-ready`, and `resync-required`. Events carry
changes or invalidation, never the historical corpus.

**Redis Stream ID**

The Redis entry identifier (`milliseconds-sequence`) used as the SSE `id` and
accepted in `Last-Event-ID` for retained-event replay. It is not a GraphQL
pagination Cursor. If the requested entry is absent or outside retained
bounds, the gateway emits `resync-required`.

**Finding Block**

A bounded columnar protobuf batch used only by the ingest client and producer
over the v2 gRPC `IngestService`. It is not a browser unit, Redis event, SSE
payload, query result, or local index.

## Source attributes and analysis

**Vulnerability Attribute**

A source-provided value used to describe, group, filter, sort, or explain a
Finding. Missing, blank, and unknown values remain distinct.

**Risk Factor**

A source-provided factor that helps explain prioritization or exposure. The
dashboard does not invent one when absent.

**Analysis**

The active query excluding only Findings whose `kaiStatus` is exactly
`invalid - norisk`. Null `kaiStatus` remains included. No trimming,
normalization, fuzzy match, or CVE deduplication is applied.

**AI Analysis**

The active query excluding only Findings whose `kaiStatus` is exactly
`ai-invalid-norisk`. Null `kaiStatus` remains included. It is distinct from
Analysis and does not infer an AI-generated status.

**Dashboard Preferences**

Versioned user-specific display choices stored separately from URL query
state. Preferences never change which Findings belong to a connection.
