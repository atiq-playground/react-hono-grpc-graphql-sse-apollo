# T02 Local infrastructure

## Outcome

ClickHouse and Redis run locally via Docker Compose with a schema shaped for the
findings corpus, so the data path has a real warehouse to target rather than a
simulated one.

## Scope

- `docker/compose.yml` defining a ClickHouse service and a Redis service with
  named volumes, health checks, and pinned image tags.
- ClickHouse DDL for a `findings` table using `MergeTree`, with an ordering key
  chosen for the dashboard's dominant access patterns (group, repo, image,
  severity, cve).
- Low-cardinality columns declared as `LowCardinality(String)` where the corpus
  justifies it: `severity`, `packageType`, `status`, `advisoryType`, `buildType`.
- `kaiStatus` nullable, since it is present on only 29,005 of 236,656 records.
- Array columns for `riskFactors` and `applicableRules`.
- `.env.example` documenting connection settings; no credentials committed.
- An Nx target that brings the stack up and waits for health.

## Acceptance criteria

- [ ] `docker compose -f docker/compose.yml up -d` brings both services to healthy
- [ ] The `findings` table exists and `DESCRIBE findings` matches the documented schema
- [ ] A trivial `INSERT` and `SELECT` round trip succeeds from a Bun script using `@clickhouse/client`
- [ ] Redis accepts `PUBLISH` and `SUBSCRIBE` from two separate connections
- [ ] Teardown leaves no orphaned volumes when explicitly requested

## Blocked by

None. Runs in parallel with T01.

## Risks

- **Docker Desktop WSL integration is currently disabled for this distro.** There
  is no `docker` binary and no `/var/run/docker.sock`. Enable it under Settings,
  Resources, WSL Integration before starting this ticket.
- ClickHouse defaults to a large memory allowance; constrain it in Compose so the
  ingest in T04 fails loudly rather than exhausting the host.
- The ordering key is expensive to change after T04 loads 236,656 rows. Settle it
  in this ticket, not later.
