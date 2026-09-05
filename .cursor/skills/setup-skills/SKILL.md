---
name: setup-skills
description: Audit and align this repository's Cursor-only agent and skill tree with its canonical root guidance. Use when repository guidance or the available skill inventory changes.
disable-model-invocation: true
---

# Set Up Cursor Skills

Use this skill to align `.cursor/agents` and `.cursor/skills` with the repository's existing authoritative guidance. It does not configure an issue tracker or create provider mirrors.

## Process

1. Read `AGENTS.md`, `docs/RULES.md`, `docs/CONTEXT.md`, `docs/STRUCTURE.md`, and relevant ADRs.
2. Inventory `.cursor/agents/*` and `.cursor/skills/*/SKILL.md`.
3. Check frontmatter names, descriptions, supporting-file links, and references to named agents or skills.
4. Remove references to nonexistent local dependencies and stale project assumptions.
5. Preserve generic skills that remain useful, but ensure project-specific instructions defer to the canonical dashboard contract.
6. Keep all repository agent guidance under `.cursor/`. Do not create `.claude`, `.agents`, or other provider-specific copies.
7. Present proposed edits before changing broad guidance unless the user has already approved an explicit plan.
8. Run only focused reference and metadata checks. Global validation belongs to its assigned phase.

Do not scaffold application code, install dependencies, configure an issue tracker, or modify root guidance unless the user explicitly includes that work.
