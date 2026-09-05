# T30 Cleanup

## Outcome

Everything the old full-corpus model left behind is removed, oversized modules
from the rewrite are split, and typecheck, Biome, and a bundle inspection all
pass on the shipped architecture.

## Scope

- Remove dead code and strings across `apps/*` and `packages/*`: the original
  historical-stream RPC, stream bootstrap descriptor, bulk-row SSE frame,
  gateway producer fill, browser worker protocol/query path/harness, and
  page-slice store actions.
- Remove unused dependencies from every `package.json` (`@bufbuild/protobuf`
  and `@repo/proto` in the dashboard, `redux` if unused, any worker-only
  helpers) and refresh `bun.lock`.
- Split files that grew past a focused size during T20 through T29 into
  colocated modules and `*.types.ts` files per
  `.cursor/rules/typescript/type-organization.mdc`.
- Reconcile `.env.example` with `apps/gateway/src/env.ts` and
  `apps/producer/src/env.ts`: every variable documented once, no stale
  `REDIS_STREAM`, `PRODUCER_URL`, or smoke-only channel entries that no code
  reads.
- Remove the `T05`/`T06` era smoke scripts that target removed RPCs
  (`apps/producer/scripts/smoke.ts`, `packages/proto/scripts/smoke.ts`) or
  repoint them at `IngestService`.
- Run `bunx nx run-many -t typecheck` and `bunx biome check .` and fix what
  they report.
- Build the dashboard and confirm the bundle contains no protobuf runtime.

## Implementation evidence and handoff (T31)

- The superseded dashboard query path, browser protobuf dependencies, legacy
  generated GraphQL file, gateway producer client, and proto v1 files are
  absent from the shipped source tree.
- Generated/build artifacts are not architecture evidence. T31 performs
  documentation and forbidden-term checks only; T32 must re-establish current
  typecheck, bundle, and runtime evidence after the final docs change.

## Acceptance criteria

- [ ] Searches for the original stream RPC, bootstrap descriptor, bulk-row frame, gateway producer fill, and browser worker path return nothing in `apps` or `packages`
- [ ] `bunx nx run-many -t typecheck` passes for every project
- [ ] `bunx biome check .` passes with no errors
- [ ] `bunx nx build dashboard` succeeds and `rg -l "bufbuild|protobuf" apps/dashboard/dist` returns nothing
- [ ] No `package.json` lists a dependency that no source file imports
- [ ] `.env.example` and both `env.ts` modules agree on variable names
- [ ] No source file exceeds the focus expectation set by the coding-style rules without a recorded reason

## Blocked by

- T24 Server-side export workflow
- T27 Explore rewrite
- T28 Overview rewrite
- T29 Detail view with live updates

## Risks

- Dependency removal can break a transitive import that only surfaces at
  build time; run the dashboard build, not just typecheck.
- Splitting files late risks churn in modules T32 will test; prefer moving
  whole functions over reshaping signatures.
- Documentation still references removed identifiers by design until T31;
  do not "clean" `docs/` here.
