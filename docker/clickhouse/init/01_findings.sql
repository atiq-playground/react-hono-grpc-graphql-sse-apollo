-- findings v2: one flattened Source Record per row (group -> repo -> image -> vulnerability),
-- upsertable so the producer can apply changes (ADR-0001, T19/T20).
--
-- ENGINE ReplacingMergeTree(updatedAt, isDeleted)
--   Background merges keep the row with the highest updatedAt per ORDER BY key; a row
--   inserted with isDeleted = 1 (and a newer updatedAt) tombstones that key. This is the
--   "insert a new version" update path (no ALTER UPDATE / DELETE mutations).
--   Writers must set updatedAt strictly greater than the previous version. Because the
--   whole row is replaced, writers that want to keep firstSeenAt must carry the previous
--   value forward; the DEFAULT only covers first insertion.
--
-- ORDER BY (`group`, repo, image, cve, packageName, packageVersion, path)  -- finding identity
--   ReplacingMergeTree deduplicates on the ORDER BY key, so the key must be the identity of
--   a finding: one CVE affecting one package instance (name + version + path) inside one
--   image. Measured on the corpus (236,656 source rows):
--     (group, repo, image, cve, packageName, path)                 -> 233,033 distinct
--     (group, repo, image, cve, packageName, packageVersion, path) -> 236,653 distinct
--   The same CVE hits the same package at several versions inside one image (up to 5), so
--   packageVersion is part of the identity. The remaining 3 collisions are exact identity
--   duplicates in the source that differ only in the `status` advisory text and fixDate;
--   they collapse under FINAL by design. `path` is '' for every corpus row but stays in the
--   key because it is part of the package-instance identity in the source schema.
--   Cardinality runs low -> high (44 groups, 725 repos, 1,025 images, 2,713 CVEs, ...), so
--   the sparse primary index still prunes context drill-downs. Attributes that change over
--   time (severity, status, cvss, kaiStatus) must not be in the key.
--
-- Readers MUST use `FROM findings FINAL` (or argMax(..., updatedAt) GROUP BY findingId) to
--   see one version per finding and to hide isDeleted rows; plain reads return every
--   unmerged version. count() without FINAL is not the finding count.
--
-- findingId = lower(hex(sipHash128(identity)))
--   Stable 32-char id derived from the identity key; it is the GraphQL `finding(id)` key,
--   the keyset-cursor tiebreaker (`ORDER BY sortCol, findingId`), and the id carried by
--   DatasetEvents. MATERIALIZED columns are not returned by `SELECT *`; select them by name.
--
-- publishedAt / fixedAt are MATERIALIZED from the source text so time-range presets filter
--   on a real DateTime. Nullable is deliberate: NULL means "no/unparsable date" (fixDate is
--   '' for 2,894 corpus rows = no fix yet), which '' or epoch 0 would misrepresent.
--   Keyset readers sorting by a Nullable column must handle the NULL tail explicitly
--   (NULLs never satisfy a tuple `>` comparison).
--
-- Skipping indexes cover the non-key filter columns (severity/status/cvss/publishedAt and
--   token/ngram search on cve, packageName, image, repo). The table is ~30 granules at the
--   default index_granularity, so GRANULARITY 1 keeps one mark per granule; verify use with
--   `EXPLAIN indexes = 1` before relying on them. Under FINAL, 24.12 ignores skipping
--   indexes unless `use_skip_indexes_if_final = 1`, which can return stale versions; leave
--   it off.
--
-- Projections give the two hot sort paths (severity + cvss, publishedAt) their own sorted
--   copy (DESC is read from the ascending copy via read-in-order). Measured on 24.12: a
--   non-FINAL `WHERE severity = 'critical' ORDER BY cvss DESC, findingId` reads 2/30
--   granules from prj_severity_cvss, but the same query with FINAL bypasses projections
--   (and skipping indexes) and scans every granule. Projections therefore only serve
--   non-FINAL reads (aggregate scans that tolerate unmerged versions or dedupe via argMax).
--   Readers must measure with `EXPLAIN` and, if FINAL latency exceeds budget, add a
--   `findings_current` materialized view in a later ticket rather than here.
--   deduplicate_merge_projection_mode = 'rebuild' is required on ReplacingMergeTree
--   (default 'throw' refuses projections) and rebuilds projection parts on each merge.
--
-- Blank source strings stay as '' (not NULL) so missing and blank remain distinct.
-- kaiStatus is the only nullable source scalar (present on 29,005 / 236,656 records).
-- riskFactors is Array(String): ingest stores object keys from the source object.
-- LowCardinality follows measured cardinality: group 44, repo 725, image 1,025,
-- packageName 775, owner 2, severity 4, packageType 7, status 2,152 (all far below 10K).
-- cve (2,713 and unbounded) and packageVersion stay String.
--
-- Migration: v1 -> v2 changes ENGINE and ORDER BY, which cannot be altered in place, so the
--   table is replaced and must be reloaded with `bunx nx run producer:ingest --force`.
--   docker-entrypoint-initdb.d only runs on an empty data volume, where the REPLACE is a
--   plain CREATE. Against an existing volume apply this file by hand (it atomically swaps
--   the table and drops v1 data), then re-ingest:
--     docker compose -f docker/compose.yml exec -T clickhouse clickhouse-client \
--       --multiquery < docker/clickhouse/init/01_findings.sql
--     bunx nx run producer:ingest --force
--   Alternatively `docker compose -f docker/compose.yml down -v && up -d` re-runs init.

CREATE OR REPLACE TABLE findings
(
    -- identity (ORDER BY key)
    `group` LowCardinality(String),
    repo LowCardinality(String),
    image LowCardinality(String),
    cve String,
    packageName LowCardinality(String),
    packageVersion String,
    path String,

    -- versioning (ReplacingMergeTree)
    updatedAt DateTime64(3) DEFAULT now64(3),
    firstSeenAt DateTime64(3) DEFAULT now64(3),
    isDeleted UInt8 DEFAULT 0,

    -- derived
    findingId String MATERIALIZED lower(hex(sipHash128(`group`, repo, image, cve, packageName, packageVersion, path))),
    publishedAt Nullable(DateTime) MATERIALIZED parseDateTimeBestEffortOrNull(published),
    fixedAt Nullable(DateTime) MATERIALIZED parseDateTimeBestEffortOrNull(fixDate),

    -- attributes
    severity LowCardinality(String),
    packageType LowCardinality(String),
    status LowCardinality(String),
    advisoryType LowCardinality(String),
    buildType LowCardinality(String),
    `type` LowCardinality(String),

    cvss Float64,
    description String,
    cause String,
    exploit String,
    fixDate String,
    published String,
    layerTime String,
    link String,
    owner LowCardinality(String),
    vecStr String,

    -- ClickHouse requires LowCardinality outside Nullable, not the reverse.
    kaiStatus LowCardinality(Nullable(String)),
    riskFactors Array(String),
    applicableRules Array(String),

    INDEX idx_published_at publishedAt TYPE minmax GRANULARITY 1,
    INDEX idx_cvss cvss TYPE minmax GRANULARITY 1,
    INDEX idx_severity severity TYPE set(8) GRANULARITY 1,
    INDEX idx_status status TYPE set(256) GRANULARITY 1,
    INDEX idx_cve cve TYPE ngrambf_v1(3, 16384, 3, 0) GRANULARITY 1,
    INDEX idx_package_name packageName TYPE tokenbf_v1(16384, 3, 0) GRANULARITY 1,
    INDEX idx_image image TYPE tokenbf_v1(16384, 3, 0) GRANULARITY 1,
    INDEX idx_repo repo TYPE tokenbf_v1(16384, 3, 0) GRANULARITY 1,

    -- `*` excludes MATERIALIZED columns, so they are listed; a projection that lacks a
    -- selected column is never chosen by the planner.
    PROJECTION prj_severity_cvss
    (
        SELECT *, findingId, publishedAt, fixedAt ORDER BY severity, cvss, findingId
    ),
    PROJECTION prj_published_at
    (
        SELECT *, findingId, publishedAt, fixedAt ORDER BY publishedAt, findingId
    )
)
ENGINE = ReplacingMergeTree(updatedAt, isDeleted)
ORDER BY (`group`, repo, image, cve, packageName, packageVersion, path)
SETTINGS index_granularity = 8192, deduplicate_merge_projection_mode = 'rebuild';
