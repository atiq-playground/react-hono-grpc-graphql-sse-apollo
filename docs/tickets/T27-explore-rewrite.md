# T27 Explore rewrite

## Outcome

The Explore route is an infinite, virtualized grid over the `findings`
connection with filters, time range, search with suggestions, analysis mode,
and a server-side export button. It loads without waiting for any stream and
stays usable while the dataset changes in Live mode.

## Scope

- Split `apps/dashboard/src/routes/explore.tsx` into
  `apps/dashboard/src/features/explore/`:
  - `ExploreFilters.tsx`: facet-driven filters (severity, status, repo, group,
    packageType) bound to URL state, using `@repo/ui` `Select` in place of
    native `<select>`.
  - `ExploreToolbar.tsx`: search input with `searchSuggestions`, analysis
    mode toggle, `TimeRangeFilter` (domain binding of `@repo/ui` `TimeRange`
    with the shared presets), live ticker, and the "N updates - Refresh"
    affordance driven by `pendingUpdates`.
  - `FindingsGrid.tsx`: TanStack Table (headless) for column definitions and
    sort state, TanStack Virtual for rows, `fetchMore` when the last rendered
    row approaches the end of loaded edges, `Skeleton` rows while loading.
  - `use-findings-connection.ts`: wraps the generated hook with URL state,
    cursor handling, and `hasNextPage`.
  - `ExportButton.tsx`: calls `createExport`, polls `exportJob`, then triggers
    `GET /api/exports/:id`.
  - `SeverityBadge.tsx`: domain binding of `@repo/ui` `Badge`.
- Replace `apps/dashboard/src/features/grid/VirtualizedFindingsGrid.tsx`.
- Sorting a column resets the cursor and refetches from the server; the grid
  never sorts loaded pages client-side.
- Row selection navigates to the detail route (T29).
- Accessible table semantics: header association survives virtualization,
  keyboard navigation reaches filters, rows, and the export button, and
  loading, empty, and error states are announced.

## Implementation evidence and deviation (T31)

- URL state currently serializes search; severity, status, repository, group,
  and package-type filters; sort; analysis mode; Time Range; and `after`.
- The grid uses manual TanStack sorting and a 320-pixel scroll threshold, with
  an explicit Load more fallback.
- Export readiness is polled every second. The emitted `export-ready` Dataset
  Event is not wired to the button.
- The detail route is `/finding/:findingId`.

## Acceptance criteria

- [ ] Explore renders its first page from a single `findings` request with no SSE data traffic and no `finding-block` frames in the network panel
- [ ] Scrolling to the end of loaded rows fetches the next cursor page; only visible rows exist in the DOM
- [ ] Changing a filter, search, time range, or analysis mode updates the URL and issues a new bounded query
- [ ] Sorting by a column issues a server query with the new sort; loaded rows are not reordered client-side
- [ ] In Live mode, an upsert from the simulator appears in the grid; in a windowed mode the refresh affordance shows the pending count and applies on click
- [ ] Export downloads a CSV whose rows match the current query and sort order
- [ ] No native `<select>` remains in the Explore feature
- [ ] Keyboard-only operation reaches every control and header semantics hold under virtualization

## Blocked by

- T25 Dashboard data layer
- T26 UI package primitives and TimeRange component

## Risks

- `fetchMore` triggered on every scroll frame thrashes the gateway; gate it on
  a threshold row and an in-flight flag.
- Live upserts that change sort position in Live mode cause visible row jumps;
  the debounced refetch from T25 is the mitigation, and it must be tested by
  eye with the simulator running.
- Splitting the route into many files risks prop drilling; use the existing
  dashboard context for shared state rather than a new provider.
