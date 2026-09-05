---
name: final-qa
description: Runs risk-based final QA for the vulnerability dashboard after all PRD features are complete. Uses Jest and React Testing Library for selected unit/integration seams and Playwright for critical browser flows without a blanket coverage threshold.
---

# Final Risk-Based QA

Use this skill only after all PRD features are implemented. Broad testing is a final hardening activity, not a mandatory tests-first loop. An earlier focused test is appropriate only when it materially reduces risk around a hard contract, transformation, or failure mode.

Read `AGENTS.md`, `docs/RULES.md`, `docs/CONTEXT.md`, `docs/STRUCTURE.md`, relevant ADRs, and `docs/PRD.md` before selecting tests.

## 1. Confirm readiness

- Confirm the complete PRD feature set is present.
- Confirm test tooling already exists in the scaffold; do not install or scaffold anything only for this workflow.
- Identify the public seams and critical browser journeys from the implemented system.
- Record any incomplete feature as an implementation gap, not as a test task.

## 2. Build a risk matrix

Rank candidate seams by impact, likelihood, and observability. Prioritize:

- source validation and bounded streaming transformations;
- immutable artifact publication and manifest-last behavior;
- Dataset Version consistency;
- Worker request validation, private R2 access, ranges, caching, and failures;
- versioned artifact, API, URL, preference, and Web Worker contracts;
- compact-index filtering, sorting, search suggestions, pagination, and export;
- route state, loading, empty, invalid, and degraded-network behavior;
- keyboard access, focus, semantics, responsive layouts, and constrained-device performance.

Select the smallest set of tests that provides meaningful evidence for the highest risks. Do not derive the set from a coverage percentage.

## 3. Assign test levels

- **Jest:** pure domain behavior, validators, artifact/query transforms, and worker-message contracts.
- **React Testing Library:** route and component integration through accessible user behavior.
- **Playwright:** a small number of critical journeys across navigation, artifact loading, Web Worker queries, grid/chart exploration, detail loading, and export.

Test through public interfaces and observable behavior. See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for boundary guidance.

## 4. Execute proportionally

Use only commands defined by the scaffolded repository. Start with the narrowest affected target, then run the final configured QA set. Include accessibility, type, build, formatting, security, and performance evidence where repository guidance assigns them to final hardening.

Never read the complete `ui_demo.json` into test or agent memory. Use small validated fixtures that preserve relevant source semantics.

## 5. Report

Report:

- risks selected and why;
- seams and journeys covered;
- exact commands run and their results;
- skipped checks and the reason;
- defects found;
- residual risks requiring manual or later evidence.

Never claim an unrun result. Coverage may be observed diagnostically, but no blanket line, branch, function, or statement threshold is required.
