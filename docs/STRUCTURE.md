# Repository structure map

Annotated map of the shipped monorepo as of the gRPC-to-SSE dashboard tickets.
Written against the tree that exists, not the original Cloudflare/R2 plan.

## Top level

| Path | Owns |
|---|---|
| `apps/dashboard` | Vite + React SPA: shell, routes, Apollo control-plane client, Zustand store, Web Worker query path, charts/grid. |
| `apps/gateway` | Hono HTTP process: Apollo GraphQL at `/graphql` (control plane) and SSE at `/api/stream` (data plane). |
| `apps/producer` | gRPC `FindingsService` that reads ClickHouse and publishes columnar blocks to a Redis Stream. One-shot ClickHouse population lives in `apps/producer/scripts/ingest.ts` (`producer:ingest`), not in the runtime `src/` tree. |
| `packages/proto` | Buf-managed `findings.proto`, generated TypeScript, dictionary/offset helpers. Shared contract for producer, gateway, and browser worker. |
| `packages/ui` | Shared shadcn / Tailwind primitives consumed by the dashboard. |
| `packages/shared` | Versioned worker message contracts validated with `zod/mini`. |
| `docker/` | Compose stack for ClickHouse + Redis and ClickHouse DDL/config. |
| `tools/infra` | Infra operational scripts: Compose `up` / `wait-healthy` / `down` helpers and the `@clickhouse/client` + Redis pub/sub smoke check. |
| `e2e/` | Playwright specs (none yet; foundation only). |
| `docs/tickets/` | Implementation tickets and dependency graph. |

## Dependency direction

- `apps/*` may depend on `packages/*`.
- Packages must not depend on apps.
- `packages/proto` is the shared wire contract for all three applications.
- Enforced in T01 via Nx tags (`type:app` / `type:package`) and `@nx/enforce-module-boundaries`.

## Process boundaries

1. **gRPC (producer → consumers):** columnar `FindingBlock` server-streaming RPC. The producer reads ClickHouse and publishes the same encoded blocks to Redis.
2. **SSE (gateway → browser):** gateway reads the Redis Stream and emits base64 `text/event-stream` frames. GraphQL never carries the firehose.
3. **Main thread vs Web Worker:** the worker owns SSE ingest, protobuf decode, the compact columnar index, filtering, sorting, pagination, and export. React renders page slices and control-plane GraphQL data only.

## Generated code

| Artifact | Location | Committed? |
|---|---|---|
| Buf / `protoc-gen-es` output | `packages/proto/src/gen/` | Yes (reproducible via `buf generate`) |
| GraphQL client operation types | `apps/dashboard/src/graphql/generated.ts` | Yes (hand-maintained stub aligned to `schema.graphql`; full codegen can replace later) |

## Deviations from early plan

- Gateway is named `gateway` (not `backend`) because the producer is also a backend service.
- Redis Streams (not only PUBLISH/SUBSCRIBE) store blocks so SSE clients can resume with `Last-Event-ID`.
- Findings-table uniqueness after ingest is **44 groups / 1025 images** for vulnerability rows: source census is 45 / 1030, but one group and five images have empty vulnerability arrays and produce no rows (see `apps/producer/scripts/census.ts`).
- Local `ui_demo.json` lives at gitignored `apps/producer/data/raw/` (copied from the sibling dashboard repo when present).

## Naming note

`apps/gateway` was chosen over `backend` so both producer and gateway read as peer backend processes with distinct roles (warehouse stream vs browser-facing gateway).
