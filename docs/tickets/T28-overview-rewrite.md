# T28 Overview rewrite

## Outcome

The Overview route is a set of chart cards, each bound to one field of
`vulnerabilityOverview`, filtered by the same filters and time range as
Explore, and refreshed by live aggregate invalidations.

## Scope

- Split `apps/dashboard/src/features/charts/OverviewCharts.tsx` and
  `apps/dashboard/src/routes/overview.tsx` into focused aggregate and chart
  modules under `apps/dashboard/src/features/overview/`.
- Each card reads its slice from the `useVulnerabilityOverview` hook (T25),
  renders a shadcn chart (Recharts) themed by design tokens, shows a
  `Skeleton` while loading, and provides a non-visual summary.
- `TimeRangeFilter` and shared filters in the Overview toolbar write through
  to URL state so Explore and Overview stay in step.
- Drill-through from a chart segment to Explore with the matching filter and
  time range applied in the URL.
- `aggregates-invalidated` in Live mode refetches the overview; in windowed
  modes it feeds the pending-updates affordance.
- Reduced-motion preference disables chart animation.

## Implementation evidence and deviation (T31)

- One `vulnerabilityOverview` operation returns the complete aggregate shape.
  Related visualizations are grouped in `DistributionCards.tsx`,
  `TopEntityCards.tsx`, and `OverviewCharts.tsx`, with dedicated published-trend
  and found-versus-fixed modules instead of one file per schema field.
- The overview uses the URL-backed Time Range. Its GraphQL operation does not
  accept the Explore analysis mode; Analysis and AI Analysis appear as exact
  exclusion counts inside `totals`.

## Acceptance criteria

- [ ] Overview renders from one `vulnerabilityOverview` request without any SSE dependency
- [ ] Displayed totals reconcile with `datasetInfo.totalCount` when no filter or time range is active
- [ ] Changing the time range re-queries and every card updates; `publishedTrend` respects the window
- [ ] Clicking a severity segment navigates to Explore with `severity` and `range` in the URL
- [ ] Analysis and AI Analysis comparisons reflect the exact `kaiStatus` exclusions from `docs/CONTEXT.md`
- [ ] Charts use design tokens for color and remain readable in dark mode
- [ ] Every card exposes an accessible text alternative and suppresses animation under reduced motion
- [ ] The overview route chunk is lazily loaded and its size is recorded

## Blocked by

- T25 Dashboard data layer
- T26 UI package primitives and TimeRange component

## Risks

- Twelve cards issuing twelve queries is a waterfall; keep one query and
  select fields per card.
- Recharts bundle weight lands entirely in this route; check the chunk after
  adding all cards.
- Default palettes fail contrast; derive colors from tokens in `globals.css`.
