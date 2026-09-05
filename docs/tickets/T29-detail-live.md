# T29 Detail view with live updates

## Outcome

The detail route shows the full Record Detail for one `findingId` from
`finding(id)`, using a fragment that covers the `detail` field group, and
reflects `finding-upserted` events for that record while the user is looking
at it.

## Scope

- Rewrite `apps/dashboard/src/routes/detail.tsx` to read `findingId` from the
  route and call the generated `useFinding` hook with a `FindingDetail`
  fragment generated from the `detail` group of the shared field registry.
- Source-preserving presentation: blank values render as blank, `kaiStatus`
  absent renders as absent, arrays (`riskFactors`, `applicableRules`) render
  as lists. Nothing is inferred.
- Live reaction: because `Finding` is keyed by `id` in the Apollo cache, a
  `finding-upserted` written by `use-dataset-events.ts` (T25) updates the
  view; show a subtle "updated just now" indicator driven by `updatedAt`.
- `finding-deleted` for the open record shows a "no longer in dataset" state
  instead of stale content.
- Back navigation returns to Explore with the previous URL state intact.
- Loading, not-found, and error states with `Skeleton` and announced status.

## Implementation evidence and deviation (T31)

- The shipped route is `/finding/:id`. A strict 32-character lowercase hex id
  check prevents malformed ids from issuing GraphQL.
- The live status uses the Zustand store's bounded recent Finding-event list.
  Upserts modify the normalized detail fields available in the row event;
  deletes evict detail and show the removed state.
- Back navigation preserves Explore state when browser history exists. A direct
  detail entry falls back to `/explore` without reconstructing absent prior URL
  state.
- The "updated" status is driven by the validated event timestamp, not by
  re-reading detail `updatedAt` from the row-shaped upsert.

## Acceptance criteria

- [ ] Opening `/finding/:findingId` issues one `finding(id)` request and renders every field in the `detail` group
- [ ] Blank source values are shown as blank, not as placeholders or omitted rows
- [ ] With the simulator running, an upsert to the open record updates the view without a manual refetch and shows the updated indicator
- [ ] A `finding-deleted` event for the open record replaces the content with an explicit removed state
- [ ] Unknown ids render a not-found state; malformed ids are rejected before a query is sent
- [ ] Returning to Explore preserves filters, sort, time range, and cursor from the URL

## Blocked by

- T25 Dashboard data layer

## Risks

- Cache normalization only helps if the upsert payload uses the same `id` and
  `__typename`; verify the `finding-upserted` schema carries both.
- The detail fragment and the SSE upsert schema must both derive from the
  registry or they will drift.
- Rendering `link` values from the dataset requires URL scheme validation per
  `.cursor/rules/react/security.mdc`.
