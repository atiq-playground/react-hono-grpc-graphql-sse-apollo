---
name: code-review
description: Review a requested diff along separate Standards and Spec axes using the vulnerability dashboard's canonical docs and concrete code evidence. Use for branches, pull requests, or local changes.
---

# Code Review

Review only; do not edit code during this workflow.

## 1. Fix the review scope

Use the fixed point supplied by the user for a branch review. Resolve it and capture the three-dot diff, changed-file list, and commit list once. For local changes in a Git repository, inspect staged and unstaged diffs. For an explicitly scoped non-Git review, use the user-named files and requirement source as the change set and state that no historical diff is available. If none of those scopes is usable, stop and report that.

## 2. Select authoritative sources

For repository standards, read:

1. `docs/RULES.md`;
2. `AGENTS.md`;
3. `docs/CONTEXT.md`, `docs/STRUCTURE.md`, relevant ADRs, and for UI changes
   `docs/design-system/`;
4. applicable `.cursor/rules/**/*.mdc`, including
   `.cursor/rules/web/design-system.mdc` for dashboard or `packages/ui` changes;
5. established local conventions where explicit guidance is silent.

For Spec compliance, use a PRD, plan, acceptance criteria, or other requirement source supplied by the user or clearly referenced by the change. Do not require an issue tracker and do not infer the intended feature from implementation alone. If no spec is available, report that the Spec axis was not reviewed.

## 3. Review two independent axes

### Standards

Check only defects introduced by the diff:

- correctness and explicit failure behavior;
- validation and immutable transformations at data boundaries;
- dependency direction and accepted architecture;
- security and private R2 access;
- accessibility and responsive behavior;
- main-thread and artifact-loading performance;
- maintainability and justified abstractions;
- risk-appropriate tests without a blanket coverage threshold.

### Spec

Classify requirement results as:

- `MISSING`;
- `PARTIAL`;
- `INCORRECT`;
- `SCOPE CREEP`;
- `UNVERIFIED`.

Do not allow a result on one axis to hide or rerank the other.

## 4. Apply dashboard-specific constraints

Verify one Nx deployable, the same-origin Worker gateway, private immutable R2 artifacts, manifest-last publication, compact Web Worker queries, AG Grid/Charts Enterprise as the sole grid/chart stack (production license via env/secret; never commit keys; local/dev may run watermarked), and separation of URL state from versioned preferences. Reject D1, Redux, a second deployment, raw-source browser parsing, or unsupported Source Record/CVE identity assumptions. For UI diffs, also verify `docs/design-system/` and `.cursor/rules/web/design-system.mdc`.

## 5. Report evidence

Every finding needs a precise file location, observed behavior or violated requirement, concrete impact, and feasible correction. Skip speculative concerns, pre-existing defects outside the diff, and style that reliable tooling already enforces. A clean review is valid.

Return:

```markdown
## Standards
<findings or clean result>

## Spec
<findings, clean result, or no spec available>

Standards: <count and worst issue>.
Spec: <count and highest-impact status, or no spec available>.
```
