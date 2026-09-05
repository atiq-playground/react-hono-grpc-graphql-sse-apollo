# Security Vulnerability Dashboard

Explore a large vulnerability corpus (236,656 source records) with a split
architecture: GraphQL for the control plane and a gRPC-to-SSE firehose for the
data plane. A browser Web Worker owns decode, the compact columnar index, and
query work so the UI thread stays responsive.

Nx monorepo on Bun workspaces.

## Architecture at a glance

| Piece | Responsibility |
|---|---|
| `apps/producer` | Streams columnar protobuf `FindingBlock`s from ClickHouse over gRPC; publishes blocks to Redis. |
| `apps/gateway` | Hono SSE relay (`/api/stream`) and Apollo Server GraphQL (`/graphql`). |
| `apps/dashboard` | Vite + React SPA; Apollo Client for control plane; Web Worker for SSE ingest and queries. |
| `packages/proto` | Buf-managed protobuf contracts and generated TypeScript. |
| `packages/ui` | Shared shadcn / Tailwind primitives. |
| `packages/shared` | Versioned worker messages and other cross-app contracts. |
| `docker/` | ClickHouse and Redis Compose stack. |

Canonical guidance: [AGENTS.md](AGENTS.md), [docs/RULES.md](docs/RULES.md),
[docs/CONTEXT.md](docs/CONTEXT.md), [docs/TECH_STACK.md](docs/TECH_STACK.md),
and [docs/tickets/](docs/tickets/).

## Prerequisites

- [Bun](https://bun.sh) (installs and scripts)
- Docker with Compose (ClickHouse and Redis)
- Node only where an Nx target explicitly requires it (for example if gRPC
  serving on Bun is unreliable)

On WSL, enable Docker Desktop WSL integration for this distro before starting
containers.

## Setup (clean clone)

Workspace scaffolding (T01) and Compose infrastructure (T02) may still be in
progress. The target shape after foundation is:

```bash
# 1. Install dependencies
bun install

# 2. Local data stores
cp .env.example .env   # when present; never commit secrets
docker compose -f docker/compose.yml up -d

# 3. Typecheck the monorepo
bunx nx run-many -t typecheck

# 4. Format / lint
bunx biome check .

# 5. Run applications (as each Nx project becomes available)
bunx nx serve producer    # gRPC stream from ClickHouse
bunx nx serve gateway     # SSE + GraphQL
bunx nx serve dashboard   # Vite React SPA
```

Package scripts may also map to the same Nx/Biome entry points (for example
`bun run dev`, `bun run typecheck`, `bun run lint`) once the root `package.json`
defines them.

Typical local flow after the data path exists: start Compose, run
`bunx nx run producer:ingest` (or confirm ClickHouse already has the corpus),
then run producer and gateway, and open the dashboard.
Verify SSE with:

```bash
curl -N http://localhost:<gateway-port>/api/stream
```

## Documentation map

| Doc | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Operating model, phases, prompt defense |
| [docs/RULES.md](docs/RULES.md) | Hard constraints (wins on conflict) |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Domain glossary |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Technologies in use |
| [docs/tickets/](docs/tickets/) | Implementation tickets and dependency graph |

`docs/STRUCTURE.md` is owned by ticket T17 and is not present until that ticket
lands.

## License

Proprietary. Do not redistribute source.
