# Tech Stack

Authoritative technology choices for the gRPC-to-SSE vulnerability dashboard.
Architecture and delivery order live in [RULES.md](RULES.md), [AGENTS.md](../AGENTS.md),
and [tickets/](tickets/).

## Frontend

| Technology | Role |
|---|---|
| **React** | Application component library and view layer. |
| **Vite** | Frontend build tool and development server for `apps/dashboard`. |
| **React Router** | Client-side navigation and route structure. |
| **Apollo Client** | GraphQL control-plane client (summaries, facets, record detail, stream descriptor). Not used for the findings firehose. |
| **Zustand** (redux middleware) | High-frequency stream status, page slices, and filter/sort UI state mutated outside the React tree; selector-based subscriptions. |
| **shadcn / Tailwind** | UI primitives and styling. Shared components live in `packages/ui`. |
| **TanStack Table** | Headless column definitions, sort state, and column visibility for the explore grid. Data processing stays in the Web Worker. |
| **TanStack Virtual** | Row virtualization over large Result Sets so only visible rows exist in the DOM. |
| **Recharts** (via shadcn charts) | Overview charts. |
| **zod/mini** | Boundary validation for URL state, worker messages, gateway inputs, and ClickHouse-facing values. |
| **Web Workers** | Own the SSE connection, protobuf decode, compact columnar index, filtering, sorting, pagination, and export. |

## Gateway and producer

| Technology | Role |
|---|---|
| **Hono** | HTTP server for `apps/gateway`: SSE data plane and GraphQL mount. |
| **Apollo Server** | GraphQL control plane at `/graphql` on the gateway. No subscriptions; the firehose is SSE. |
| **gRPC** | Producer-to-consumer streaming of columnar `FindingBlock` messages over HTTP/2. |
| **Buf** | Protobuf lint, generate, and schema management for `packages/proto`. |
| **Connect-ES** | TypeScript gRPC / Connect transport over the Buf-generated contracts. |

## Data stores

| Technology | Role |
|---|---|
| **ClickHouse** | Analytical warehouse holding the ingested findings corpus; source of producer streams and GraphQL aggregates. |
| **Redis** | Pub/Sub fan-out of encoded blocks so gateway replicas can relay without each opening a ClickHouse stream. |

## Observability and quality

| Technology | Role |
|---|---|
| **Sentry** | Distributed tracing and error reporting across producer, gateway, and dashboard. |
| **Jest** + **React Testing Library** | Selected unit and integration seams (established in the test-foundation ticket). |
| **Playwright** | Critical browser journeys during risk-based QA. |

## Tooling and runtime

| Technology | Role |
|---|---|
| **Nx** | Monorepo project boundaries and task orchestration. |
| **Bun** | Package manager and primary runtime for installs and scripts. |
| **Biome** | Formatting and lint. |
| **Docker** | Local ClickHouse and Redis via Compose under `docker/`. |

## Architecture split (not alternatives)

- **Control plane:** Apollo Client / Apollo Server GraphQL for summaries, facets, detail, and stream bootstrap.
- **Data plane:** gRPC producer blocks published to Redis, relayed by Hono SSE as base64 frames, decoded in a browser Web Worker into a compact columnar index.
- **Not this architecture:** object-storage artifact pipelines, edge Worker gateways, DuckDB/Parquet browser warehouses, or MUI/AG Grid stacks.
