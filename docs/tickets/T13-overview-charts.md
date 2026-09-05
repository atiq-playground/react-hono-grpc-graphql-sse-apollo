# T13 Overview charts

## Outcome

The overview route summarizes the corpus with charts driven by GraphQL aggregates
rather than by client-side computation over the record index.

## Scope

- shadcn chart components (Recharts underneath) themed through the same CSS
  variables as the rest of the design system.
- Views covering severity distribution, the largest groups and repositories by
  finding count, risk factor prevalence, and the Analysis versus AI Analysis
  comparison.
- Data sourced from the `summary` and `facets` resolvers in T07, so the overview
  renders without waiting for the stream to finish ingesting.
- Drill-through from a chart segment into the explore route with the
  corresponding filter applied through URL state.
- Accessible presentation: charts are not the only representation of the data,
  colour is not the sole carrier of meaning, and an equivalent accessible summary
  is available.
- Respect for reduced-motion preferences in any chart animation.

## Acceptance criteria

- [ ] Charts render from GraphQL aggregates before the SSE stream completes
- [ ] Displayed totals reconcile with ClickHouse counts, including 236,656 overall
- [ ] The Analysis and AI Analysis comparison reflects the exact `kaiStatus` exclusions from [CONTEXT.md](../CONTEXT.md)
- [ ] Clicking a segment navigates to explore with the matching filter applied and reflected in the URL
- [ ] Charts adapt to dark mode through design tokens, not hardcoded colours
- [ ] Chart information is available to screen readers in non-visual form
- [ ] Animations are suppressed under reduced-motion preferences

## Blocked by

- T07 Gateway GraphQL layer
- T11 Dashboard shell and routing

## Risks

- Recharts adds meaningful bundle weight. Keep the overview route lazily loaded
  and check its chunk size.
- Computing these summaries in the browser instead of ClickHouse would work but
  would tie the overview to stream completion; keep aggregation server-side.
- Default chart palettes usually fail contrast requirements. Derive colours from
  the design tokens.
