# T17 Repository structure map

## Outcome

`docs/STRUCTURE.md`, currently empty, documents the repository as it actually
shipped rather than as it was planned.

This ticket is deliberately last. It is written against the real tree, not the
proposed one.

## Scope

- Annotated map of `apps/dashboard`, `apps/gateway`, `apps/producer`, and
  `packages/proto`, `packages/ui`, `packages/shared`, describing what each
  directory owns.
- The dependency direction rules: `apps/*` may depend on `packages/*`, packages
  must not depend on apps, and `packages/proto` is the shared contract consumed
  by all three applications.
- Where the two process boundaries sit and why: the gRPC boundary between
  producer and gateway, and the SSE boundary between gateway and browser.
- Where the main-thread boundary sits: what the Web Worker owns versus what React
  renders.
- The location of generated code (Buf and GraphQL codegen output) and which
  parts are committed versus generated at build time.
- Location of `docker/`, `e2e/`, and the gitignored `apps/producer/data/raw/`.
- A note that `apps/gateway` was named `gateway` rather than `backend` because the
  producer is also a backend service.

## Acceptance criteria

- [ ] Every directory in the map exists in the repository
- [ ] Every directory that exists and matters is in the map
- [ ] The stated dependency rules match the Nx boundary configuration enforced in T01
- [ ] The document reflects the shipped tree, including any deviations from the original plan
- [ ] Deviations from the plan are noted explicitly rather than silently reconciled
- [ ] Links resolve and no emojis are present

## Blocked by

- T12 Virtualized grid
- T14 Sentry distributed tracing
- T16 Documentation rewrite

Effectively blocked by the full set: this is the closing ticket.

## Risks

- Writing this early guarantees it will be wrong. The value comes from describing
  reality, so it must be written last.
- If the shipped structure diverges from the plan, the divergence is the most
  useful content in the document. Record it rather than hiding it.
