# T15 Test foundation

## Outcome

Jest with React Testing Library and Playwright are fully configured and provably
runnable, together with a CI workflow that publishes Playwright screenshots as PR
annotations.

**No test files are written in this ticket.** The foundation exists so that focused
tests can be added later without any setup work.

## Scope

- Jest configured for the workspace with TypeScript transformation, module
  resolution matching the `tsconfig` path aliases, and separate projects for
  browser (jsdom) and node environments.
- React Testing Library set up with the appropriate matchers and a shared render
  helper that composes the providers from T11.
- Playwright configured with the browser targets, a base URL, and a web server
  hook that boots the dashboard and gateway for a run.
- Screenshot and trace capture enabled on failure.
- A GitHub Actions workflow that installs, builds, runs the suites, uploads
  Playwright artifacts, and annotates pull requests with captured screenshots.
- Nx targets so `test` and `e2e` are ordinary project tasks.

## Acceptance criteria

- [ ] `bunx nx run-many -t test` executes and reports zero tests without erroring on configuration
- [ ] `bunx nx e2e dashboard` starts the web server, launches a browser, and exits cleanly with no specs present
- [ ] Path aliases and `packages/*` imports resolve inside Jest
- [ ] The render helper composes providers and typechecks
- [ ] The workflow file is valid and its steps are correct on inspection
- [ ] No `.test.ts`, `.spec.ts`, or equivalent files are added anywhere

## Blocked by

- T01 Workspace foundation

## Risks

- The repository has no git remote yet, so the workflow cannot actually execute in
  CI until one is added. That is expected and does not block this ticket.
- Jest with Bun and ESM is a well-known configuration trap; budget time for module
  resolution rather than treating it as boilerplate.
- Worker and protobuf imports need explicit handling in the Jest environment or
  later tests touching them will fail confusingly.
