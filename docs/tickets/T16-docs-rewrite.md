# T16 Documentation rewrite

> **Superseded as current guidance** by
> [ADR-0001](../adr/0001-clickhouse-authoritative-query-engine.md) and
> [T31](T31-docs-rewrite.md). This ticket records the first architecture's
> documentation pass and remains as history.

## Outcome

The repository's canonical documentation describes the architecture actually
being built, replacing the superseded Cloudflare Worker, private R2, MUI, and
DuckDB/Parquet guidance that currently contradicts it.

This ticket has no code dependencies and can run in parallel from the start. It
is the strongest candidate for delegation to a subagent.

## Scope

Rewrite:

- [TECH_STACK.md](../TECH_STACK.md): the complete stack, replacing the current
  partial list. React, Vite, React Router, Apollo Client, Zustand with redux
  middleware, shadcn and Tailwind, TanStack Table and Virtual, Recharts via
  shadcn charts, `zod/mini`, Hono, Apollo Server, gRPC with Buf and Connect-ES,
  ClickHouse, Redis, Web Workers, Sentry, Jest with React Testing Library,
  Playwright, Nx, Bun, Biome, Docker.
- [RULES.md](../RULES.md): remove the R2, Cloudflare Worker gateway, manifest and
  artifact, and MUI design-system constraints. Add the constraints this
  architecture actually needs: the control-plane versus data-plane split, no
  GraphQL subscriptions, worker ownership of the index, columnar protobuf blocks,
  exact `kaiStatus` matching, and boundary validation with `zod/mini`.
- [AGENTS.md](../../AGENTS.md): replace the five-day R2 delivery order with the
  phase seams in [the ticket index](README.md). Keep the Prompt Defense Baseline
  and the engineering principles, which remain valid.
- [README.md](../../README.md): currently the untouched Bun template readme.
  Replace with a real project overview and the setup sequence, including Docker.

Amend:

- [CONTEXT.md](../CONTEXT.md): the glossary is confirmed accurate against the
  source corpus and largely survives. Remove artifact and manifest phrasing from
  the Dataset Version entry, and add the streaming vocabulary this architecture
  introduces: Finding Block, Stream Cursor, Compact Index.

Correct:

- [`.cursor/rules/web/design-system.mdc`](../../.cursor/rules/web/design-system.mdc):
  written for MUI, `productTokens`, and theme-mapping paths that do not exist
  here. Rewrite for shadcn and Tailwind.
- [`.cursor/rules/common/release.mdc`](../../.cursor/rules/common/release.mdc):
  assumes Cloudflare and DigitalOcean droplet deployment and Release Please.
  Reduce to what applies, or remove it.

Remove dangling references to `docs/design-system/`, `docs/PRD.md`, and
`docs/adr/`, none of which exist in this repository.

## Acceptance criteria

- [ ] No document references R2, Cloudflare Workers, wrangler, MUI, DuckDB, or Parquet as part of this architecture
- [ ] No document links to a file that does not exist
- [ ] `TECH_STACK.md` covers every technology listed above
- [ ] `RULES.md` and `AGENTS.md` agree with each other and with this ticket set
- [ ] The `CONTEXT.md` glossary entries still match the measured corpus
- [ ] No emojis are present in any committed documentation
- [ ] `README.md` setup instructions are followable from a clean clone

## Blocked by

None.

## Risks

- `RULES.md` states that it wins on conflict, so leaving stale constraints in it
  actively misdirects future work. This is the highest-value correction in the set.
- The Prompt Defense Baseline and the accessibility, security, and validation
  principles are still correct. Rewriting should not discard them.
- `docs/STRUCTURE.md` is deliberately excluded here and handled by T17.
