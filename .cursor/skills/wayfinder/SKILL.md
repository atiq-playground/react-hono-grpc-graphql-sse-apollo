---
name: wayfinder
description: Map a large ambiguous effort into decision tickets and resolve one decision at a time until an implementation route is clear. Store or publish the map only where the user explicitly authorizes.
disable-model-invocation: true
---

# Wayfinder

Use this for work too ambiguous or large for one implementation session. The output is a decision map, not application code.

## Principles

- Name the destination first; it fixes scope.
- Record settled decisions once and link to their evidence.
- Keep only questions that are precise enough to resolve as tickets.
- Keep foreseeable but still-unformulated questions in a fog section.
- Resolve one decision per session unless the user explicitly coordinates parallel independent research.
- Do not assume an issue tracker, labels, assignees, branches, or provider-specific dependency features.

## Map

```markdown
# <Destination>

## Notes
<Authoritative docs, constraints, and standing instructions.>

## Decisions so far
- <Decision title> - <one-line result and evidence pointer>

## Open decisions
- <Question, dependencies, and resolution method>

## Not yet specified
<In-scope fog that cannot yet be phrased as a precise question.>

## Out of scope
<Explicit boundaries.>
```

## Chart the map

1. Read the authoritative requirement source plus `AGENTS.md`, `docs/RULES.md`, `docs/CONTEXT.md`, `docs/STRUCTURE.md`, and relevant ADRs.
2. Interview the user to make the destination and success evidence precise.
3. Identify decision questions across product semantics, source evidence, contracts, architecture, UX, security, accessibility, performance, and operations.
4. Mark blocking relationships and separate precise questions from fog.
5. Present the map in chat. Save or publish it only to a destination the user explicitly names and authorizes.

## Work a decision

1. Load the map and choose one unblocked open decision.
2. Gather only the evidence required for that question.
3. Use `/prototype` when a throwaway artifact would clarify behavior or appearance.
4. Use `/domain-modeling` when vocabulary or an ADR is genuinely being settled.
5. Record the answer, evidence, consequences, and newly visible questions.
6. Stop when the decision is resolved; implementation starts through a separate plan or request.

Keep the accepted dashboard architecture fixed unless revisiting a named ADR is itself the authorized decision.
