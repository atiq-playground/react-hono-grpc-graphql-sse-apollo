---
name: to-tickets
description: Break a plan, PRD, or conversation into reviewable vertical-slice tickets with explicit dependencies. Publish only when the user names and authorizes a destination.
disable-model-invocation: true
---

# To Tickets

Turn an approved body of work into tracer-bullet tickets. This skill has no default issue tracker and does not require repository tracker configuration.

## Process

1. Read the authoritative requirement source and the dashboard's canonical docs.
2. Split work into the thinnest complete vertical slices that preserve the five-day delivery order and accepted architecture.
3. Give each ticket a user-visible outcome, acceptance criteria, dependencies, and residual risk.
4. Keep broad final QA after all PRD feature tickets. Create an earlier focused-test ticket only for a hard seam where it materially reduces risk.
5. Present the draft ticket graph and confirm granularity and blocking edges with the user.
6. Publish only if the user explicitly names and authorizes a destination. Otherwise return the approved ticket set in chat.

## Ticket shape

```markdown
# <Ticket title>

## Outcome
<The complete behavior this slice delivers.>

## Acceptance criteria
- [ ] <Observable criterion>

## Blocked by
<Ticket titles or "None".>

## Risks
<Important boundary or validation risks.>
```

Do not assume GitHub, GitLab, Linear, local markdown, labels, parent issues, or provider-specific dependency features. Do not create files or external issues without explicit authorization.
