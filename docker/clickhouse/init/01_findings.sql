-- findings: one flattened Source Record per row (group -> repo -> image -> vulnerability).
--
-- ORDER BY (`group`, repo, image, severity, cve)
--   Matches dashboard dominant filters (context drill-down, then severity, then CVE).
--   Settled here because changing the key after T04 loads 236,656 rows is expensive.
--
-- Blank source strings stay as '' (not NULL) so missing and blank remain distinct.
-- kaiStatus is the only nullable scalar (present on 29,005 / 236,656 records).
-- riskFactors is Array(String): ingest stores object keys from the source object.
-- buildType is LowCardinality per T02; the measured corpus uses `type` for the
-- vulnerability classification string — ingest may leave buildType as ''.

CREATE TABLE IF NOT EXISTS findings
(
    `group` String,
    repo String,
    image String,

    cve String,
    severity LowCardinality(String),
    packageName String,
    packageVersion String,
    packageType LowCardinality(String),
    path String,
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
    owner String,
    vecStr String,

    -- ClickHouse requires LowCardinality outside Nullable, not the reverse.
    kaiStatus LowCardinality(Nullable(String)),
    riskFactors Array(String),
    applicableRules Array(String)
)
ENGINE = MergeTree
ORDER BY (`group`, repo, image, severity, cve);
