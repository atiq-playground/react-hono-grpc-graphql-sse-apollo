# T24 Server-side export workflow

## Outcome

Exporting the current matching Findings as CSV is a gateway job: the client requests
it through a mutation, ClickHouse streams `CSVWithNames` straight to an
artifact, an `export-ready` event announces completion, and the browser
downloads the file. No export work happens in the browser.

## Scope

- Schema: `createExport(input: ExportInput!): ExportJob!` mutation taking the
  same `filters`, `sort`, `search`, `timeRange`, and `analysisMode` as
  `findings`; `exportJob(id: ID!): ExportJob` query with `status`,
  `rowCount`, `downloadUrl`, and `expiresAt`.
- Job store in Redis keyed by job id with `EXPORT_TTL_SECONDS` expiry.
- `apps/gateway/src/graphql/export/` modules: job creation, ClickHouse
  `FORMAT CSVWithNames` streamed with the same query builder as `findings`
  (no `LIMIT`), piped to `EXPORT_DIR/{jobId}.csv`, never buffered in Node.
- Jobs run through one asynchronous in-process queue and publish
  `export-ready { jobId }` to the Redis Stream when complete.
- `GET /api/exports/:id` download route that validates the id, checks the job
  is ready and unexpired, and streams the artifact with `Content-Disposition`.
- Formula-injection escaping: cell values beginning with `=`, `+`, `-`, `@`,
  tab, or carriage return are prefixed so spreadsheet clients do not evaluate
  them; standard CSV quoting for delimiters and quotes.
- CSV column order follows the `explore` group of the shared field registry.
- Add `EXPORT_DIR`, `EXPORT_SYNC_ROW_LIMIT`, and `EXPORT_TTL_SECONDS` to
  `apps/gateway/src/env.ts` and `.env.example`.

## Implementation evidence and deviation (T31)

- `EXPORT_SYNC_ROW_LIMIT` remains a validated, reserved policy boundary; it
  does not currently select an inline workflow.
- Redis stores expiring job metadata. CSV artifacts are written with confined
  paths and restrictive local permissions, but they are not proactively
  deleted when metadata expires. Downloads are refused after the job expires.
- The dashboard polls `exportJob`; `export-ready` is still emitted for live
  consumers but does not currently resolve the dashboard job.
- The artifact store is local gateway disk. Restart recovery can resume
  metadata-backed incomplete jobs on the same filesystem, but multi-replica
  delivery requires shared storage.

## Acceptance criteria

- [ ] `createExport` for a filtered query produces a CSV whose row count equals `findings.totalCount` for the same arguments, in the same sort order
- [ ] The CSV header matches the `explore` field group from `packages/shared`
- [ ] A value such as `=HYPERLINK(...)` in the source is escaped in the artifact
- [ ] Gateway memory stays flat while exporting all 236,653 current Findings
- [ ] A large export publishes `export-ready` and `exportJob(id)` reports `READY` with a `downloadUrl`
- [ ] `GET /api/exports/:id` with an unknown, expired, or malformed id returns an explicit 404 or 400
- [ ] Expired downloads are refused after `EXPORT_TTL_SECONDS`; local artifact residue is measured and recorded

## Blocked by

- T21 Gateway GraphQL query layer
- T22 Gateway SSE change relay

## Risks

- `EXPORT_DIR` is local disk; a multi-replica gateway needs shared storage.
  Record this as a known limit rather than solving it now.
- Download URLs are unauthenticated in this playground. Make job ids
  unguessable and short-lived, and note the boundary in the security review.
- Streaming ClickHouse output while a client disconnects must cancel the
  query, not leave it running.
