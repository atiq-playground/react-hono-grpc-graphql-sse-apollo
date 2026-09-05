# T12 Virtualized grid

> **Superseded** by [ADR-0001](../adr/0001-clickhouse-authoritative-query-engine.md).
> Virtualization over the Result Set, filter and sort controls, detail
> navigation, and accessibility requirements are carried by
> [T27](T27-explore-rewrite.md) over Apollo cursor pages; export moves to
> [T24](T24-server-side-export.md). "Usable while the stream is still
> ingesting" becomes "usable while the dataset is changing (Live)" per the ADR.
> Content below is kept as history.

## Outcome

The explore route renders the full Result Set in a virtualized grid that scrolls
236,656 records smoothly, driven entirely by worker queries and the page slices
held in the store. This is the vertical slice closing: warehouse to browser.

## Scope

- `@tanstack/react-table` in headless mode for column definitions, sorting state,
  and column visibility, with no built-in data processing; all filtering and
  sorting is delegated to the worker from T09.
- `@tanstack/react-virtual` for row virtualization over the Result Set length,
  requesting page slices as the viewport moves.
- Rendering through the shadcn table primitives in `packages/ui` with Tailwind, so
  the grid inherits the design system rather than shipping its own styling.
- Row selection leading to the detail view, which lazily fetches Record Detail
  through GraphQL rather than reading from the index.
- Filter and sort controls populated from the `facets` query, writing through to
  URL state from T11.
- Export action invoking the worker's CSV export over the full Result Set.
- Empty, loading, streaming-in-progress, and error states, including the case
  where the grid is usable while the stream is still ingesting.
- Accessible table semantics with keyboard navigation and screen-reader-correct
  headers despite virtualization.

## Acceptance criteria

- [ ] The grid scrolls the full 236,656-record Result Set without dropped frames
- [ ] Only visible rows exist in the DOM at any time
- [ ] Changing a filter updates the grid without blocking the main thread
- [ ] Sorting a column reorders the full Result Set, not just the loaded page
- [ ] The grid is usable and shows honest progress while the stream is still ingesting
- [ ] Selecting a row opens detail populated by a lazy GraphQL fetch
- [ ] Export produces a CSV covering the entire Result Set in current sort order
- [ ] Keyboard navigation reaches every interactive element and header semantics survive virtualization

## Blocked by

- T09 Worker query engine
- T10 Zustand store and Context boundaries
- T11 Dashboard shell and routing

## Risks

- Virtualized tables are a recurring accessibility failure. Rows entering and
  leaving the DOM must not break header association or focus.
- Scroll-driven page requests can thrash. Debounce or predict the fetch window.
- Variable row heights would complicate virtualization considerably; prefer fixed
  heights unless the design demands otherwise.
