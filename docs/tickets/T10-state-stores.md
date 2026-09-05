# T10 Zustand store and Context boundaries

## Outcome

Stream data lands in a Zustand store using the redux middleware, mutated outside
React's component tree, and components subscribe only to the fragments they
render. React Context is reserved for the low-frequency concerns it suits.

## Scope

- A Zustand store with the redux middleware (actions and reducer), covering:
  - Stream ingestion status: records received, total expected, connection state,
    reconnect activity.
  - Aggregates and counters surfaced in the UI.
  - The current page slice returned by the worker.
  - Active filter, sort, and search state.
- Selector-based subscriptions so a counter component re-renders on count changes
  without reacting to page-slice changes.
- Cross-tab sharing via `BroadcastChannel` for operational state that should stay
  consistent across tabs.
- React Context limited to: theme and dark mode, authentication and permissions
  configuration, design-system injection within local component trees, and
  per-workspace store instances if multiple dashboard grids are ever rendered on
  one page.
- A store factory rather than a module-level singleton, so an isolated instance
  can be injected per workspace context.

## Acceptance criteria

- [ ] High-frequency stream progress updates do not re-render components that only read unrelated state
- [ ] The full record set is not duplicated into the store; the worker remains the owner of the index
- [ ] Redux devtools show discrete, named actions for stream and query events
- [ ] Opening a second tab shares the designated operational state through `BroadcastChannel`
- [ ] Two store instances created by the factory remain fully independent
- [ ] No Context provider carries high-frequency stream data

## Blocked by

- T08 Worker decoder and columnar index

## Risks

- Ingest progress can fire far faster than a frame. Batch or throttle updates into
  the store, or the isolation benefit is lost to render churn.
- The line between store and Context is easy to blur. Anything that changes more
  than a few times per second belongs in the store.
- Storing the page slice as a new array each time is intentional; do not mutate
  in place to avoid allocation.
