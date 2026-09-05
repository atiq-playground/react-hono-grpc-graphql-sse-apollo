# T19 ClickHouse schema v2 and ingest mapping

## Outcome

The ClickHouse `findings` table becomes a replaceable, identity-keyed store with
a stable `findingId`, materialized time columns, and the skipping indexes and
projections the bounded GraphQL queries in T21 rely on. Ingest maps the source
corpus onto the new columns.

## Scope

- Rewrite `docker/clickhouse/init/01_findings.sql`:
  - `ENGINE = ReplacingMergeTree(updatedAt, isDeleted)`.
  - `ORDER BY (group, repo, image, cve, packageName, packageVersion, path)` as
    the identity key so replace and dedup work.
  - New columns: `findingId String MATERIALIZED lower(hex(sipHash128(...)))`
    over the identity columns, `updatedAt DateTime64(3)`,
    `firstSeenAt DateTime64(3)`, `isDeleted UInt8`,
    `publishedAt Nullable(DateTime) MATERIALIZED parseDateTimeBestEffortOrNull(published)`,
    and `fixedAt` derived from `fixDate` the same way.
  - Skipping indexes: `minmax` on `publishedAt` and `cvss`, `set` on
    `severity` and `status`, `ngrambf_v1` on `cve`, `tokenbf_v1` on
    `packageName`, `image`, and `repo`.
  - Projections for the `(severity, cvss DESC, findingId)` and
    `(publishedAt, findingId)` sort paths.
- Document in the DDL header that queries use `FINAL`, and that a
  `findings_current` materialized view is added only if projections are
  bypassed under `FINAL` or latency exceeds budget after measurement.
- Enable the ClickHouse query cache for overview aggregates with a short TTL
  keyed per dataset version (settings in `docker/clickhouse/config.d/` or per
  query, decided at implementation).
- Extend `apps/producer/src/finding-row.ts` and `finding-row.types.ts` with the
  new fields (`findingId` is computed by ClickHouse; `updatedAt`,
  `firstSeenAt`, `isDeleted` are supplied by the writer).
- Route `apps/producer/scripts/ingest.ts` through the producer gRPC ingestion
  path introduced in T20, or leave a documented direct-insert fallback until
  T20 lands; either way `ingest --force` drops and recreates the table.

## Implementation evidence and deviation (T31)

- Bounded census evidence showed that omitting `packageVersion` yields only
  233,033 distinct identities. Including it yields 236,653 current Findings
  from 236,656 Source Records; three source identity duplicates collapse under
  `FINAL` by design.
- The DDL documents measured ClickHouse 24.12 behavior: `FINAL` bypasses the
  projections and skipping indexes in this table shape. No speculative
  `findings_current` materialized view was added.
- No overview query-cache setting was added. Current correctness uses direct
  parameterized queries; cache policy remains a measured future optimization.

## Acceptance criteria

- [ ] `bunx nx run producer:ingest --force` writes 236,656 Source Records and ClickHouse reports 236,653 current Findings with `SELECT count() FROM findings FINAL`
- [ ] `SELECT count(DISTINCT findingId) FROM findings FINAL` equals the row count
- [ ] `publishedAt` is non-null for every row whose `published` string parses, and null where it does not
- [ ] `EXPLAIN indexes = 1` on a severity plus cvss sort shows the projection or skipping index in use
- [ ] Re-inserting a row with the same identity key and a newer `updatedAt` yields one row under `FINAL`
- [ ] No column in the v2 DDL changes the meaning of a source-provided Vulnerability Attribute; blanks remain `''`

## Blocked by

None.

## Risks

- Changing `ORDER BY` after 236,656 rows are loaded is a full reload;
  `ingest --force` is the accepted cost and must be documented in the ticket
  README verification steps.
- `FINAL` can bypass projections on some ClickHouse versions. Measure before
  adding a materialized view; do not add one speculatively.
- `parseDateTimeBestEffortOrNull` is permissive. Spot-check a sample of parsed
  `publishedAt` values against the raw `published` strings.
- The identity key is a settled current-Finding rule, not an equation of a
  Finding with a CVE and not a cross-Dataset-Version identity claim.
