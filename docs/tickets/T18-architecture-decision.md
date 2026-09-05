# T18 Architecture decision and documentation realignment

## Outcome

The ClickHouse-authoritative model is recorded as an accepted decision, the
deferred binary live transport is recorded as a proposed one, and every
document that previously made the browser Web Worker the query owner points at
the new decision instead. No application code changes.

## Scope

- `docs/adr/0001-clickhouse-authoritative-query-engine.md` following
  `.cursor/skills/domain-modeling/ADR-FORMAT.md`: decision statement,
  considered options, and the requirement classification (still required with
  server equivalent, obsolete, product decision before removal).
- `docs/adr/0002-binary-live-transport-deferred.md` with `status: proposed`:
  WebSocket or fetch `ReadableStream` carrying raw protobuf `DatasetEvent`s,
  benefits, costs, measured trigger, and a design sketch.
- New tickets T18 through T32 in `docs/tickets/` using the existing template.
- A "Superseded" note under the title of T05, T06, T08, T09, T10, and T12
  naming ADR-0001 and the new ticket that carries each still-required
  requirement. Existing content is kept.
- `docs/tickets/README.md`: index entries, dependency graph, Phase 5 seam, and
  parallelism notes for the new lane structure.
- `docs/RULES.md`: rewrite the worker-owns-the-index, columnar-block SSE, and
  Architecture Boundaries producer/browser clauses to the ADR-0001 model.
- `AGENTS.md`: point the "Keep heavy query work off the UI thread" principle
  and the Phase 3 Browser description at ADR-0001 with minimal edits.
- `.cursor/rules/`: update `web/design-system.mdc`, `react/patterns.mdc`,
  `web/patterns.mdc`, `common/code-review.mdc`, `common/performance.mdc`, and
  `web/coding-style.mdc` clauses that reference worker filtering, the compact
  browser index, or the legacy worker directory.

## Acceptance criteria

- [ ] `docs/adr/0001-clickhouse-authoritative-query-engine.md` exists, states the decision, and classifies every legacy browser-index dependent listed in the plan
- [ ] `docs/adr/0002-binary-live-transport-deferred.md` exists with `status: proposed` frontmatter and a measured trigger to revisit
- [ ] Tickets T18 through T32 exist, follow the template, and each names its blockers
- [ ] T05, T06, T08, T09, T10, and T12 carry a supersession note and retain their original content
- [ ] `docs/tickets/README.md` indexes T18 through T32, its mermaid graph includes them, and it documents Phase 5 and Lane 0
- [ ] No clause in `docs/RULES.md`, `AGENTS.md`, or `.cursor/rules/**` still requires the browser Web Worker to own filtering, sorting, pagination, or export
- [ ] No application code, dependency, or configuration file is changed

## Blocked by

None.

## Risks

- `docs/RULES.md` wins on conflict, so a stale clause left behind actively
  misdirects T19 through T29. Search for the old browser worker, index,
  columnar browser transport, and encoded-frame vocabulary after editing.
- Over-rewriting AGENTS.md or CONTEXT.md here duplicates T31. Keep those edits
  to the two AGENTS.md passages; CONTEXT.md vocabulary changes wait for T31.
- Mermaid node identifiers cannot contain spaces; the README graph must keep
  the `TNN[label]` form.
