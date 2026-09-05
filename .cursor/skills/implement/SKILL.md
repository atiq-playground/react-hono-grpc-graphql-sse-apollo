---
name: implement
description: "Implement vulnerability-dashboard work from an authoritative PRD, plan, or user request while preserving repository architecture and phase boundaries."
disable-model-invocation: true
---

# Implement

Read `AGENTS.md`, `docs/RULES.md`, `docs/CONTEXT.md`, `docs/STRUCTURE.md`, relevant ADRs, and the authoritative requirement source before changing code. For UI work in `apps/dashboard` or `packages/ui`, also read `docs/design-system/` and apply `.cursor/rules/web/design-system.mdc`.

1. Confirm scope, acceptance evidence, and unresolved decisions.
2. Implement the thinnest complete vertical slice that preserves the fixed Nx, single-Worker, private-R2, and browser Web Worker architecture.
3. Validate source, artifact, API, URL, local-storage, and worker-message boundaries touched by the change.
4. Use the repository's existing Bun, Nx, and Biome commands when they exist. Do not scaffold or install tools outside the active phase.
5. Add an early focused test only when it materially reduces risk around a hard seam. Do not switch implementation into blanket tests-first work.
6. Complete all PRD features before invoking `/final-qa` for broad Jest, React Testing Library, and Playwright coverage.
7. Use `/code-review` for an evidence-based review when the requested change set is complete.

Do not commit, push, create a pull request, or modify external systems unless the user explicitly asks.
