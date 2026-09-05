# T01 Workspace foundation

## Outcome

The repository is an Nx monorepo on Bun workspaces with the three application
boundaries and three shared packages in place, and the existing flat template
has been absorbed rather than abandoned. A developer can clone, install, and
typecheck every project with one command.

## Scope

- `git init` with a `.gitignore` covering `node_modules`, `dist`, `.nx`, `.env`,
  and `apps/producer/data/raw/`.
- Nx workspace (`nx.json`) plus Bun workspaces in the root `package.json`.
- Biome for formatting and lint, replacing any ESLint remnants.
- Create `apps/dashboard` (Vite + React 19), `apps/gateway`, `apps/producer`,
  and `packages/proto`, `packages/ui`, `packages/shared`.
- Migrate `src/components/ui/*` and `styles/globals.css` into `packages/ui`,
  preserving the shadcn `components.json` aliases so future `shadcn add` works.
- Move the app entry from `src/App.tsx` and `src/frontend.tsx` into
  `apps/dashboard`, converting from the Bun HTML-import build to Vite.
- Delete `build.ts`, `src/index.ts` (the old Bun server), and `src/APITester.tsx`.
- Root `tsconfig` with project references and strict settings carried over from
  the existing config, including `noUncheckedIndexedAccess`.

## Acceptance criteria

- [ ] `bun install` completes from a clean checkout
- [ ] `bunx nx run-many -t typecheck` passes across all six projects
- [ ] `bunx nx serve dashboard` boots a Vite dev server rendering the migrated shell
- [ ] `bunx biome check .` passes
- [ ] `packages/ui` exports the shadcn primitives and the dashboard consumes them through the package, not a relative path
- [ ] No file remains at the repository root `src/`
- [ ] `apps/dashboard` may import `packages/*`; an Nx boundary rule forbids the reverse

## Blocked by

None.

## Risks

- Tailwind v4 configuration moves from the Bun plugin to the Vite plugin; the
  CSS-first `@theme` setup in `globals.css` must survive the move.
- Nx project inference with Bun workspaces can be fussy; prefer explicit
  `project.json` targets over inferred ones where behavior is ambiguous.
- Deleting the Bun server is intentional. Nothing should depend on it once
  `apps/gateway` exists, but confirm before removal.
