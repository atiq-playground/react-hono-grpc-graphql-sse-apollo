# T11 Dashboard shell and routing

## Outcome

The dashboard application shell exists: providers, lazy routes, layout, theming,
URL-backed exploration state, and versioned preferences, with the Apollo client
wired to the gateway.

## Scope

- React Router with lazy-loaded route modules for overview, explore, detail, and
  compare.
- Provider composition in `apps/dashboard/src/app`: Apollo, theme, and the store
  factory from T10.
- Apollo Client configured against `/graphql` with a normalized cache, used only
  for control-plane queries.
- Application layout shell: navigation, header, content region, and the loading
  and error states for remote data.
- Filter and sort state serialized to the URL so a Result Set view is shareable,
  with validation of inbound URL parameters through `zod/mini`.
- Preferences stored separately from URL state, versioned, and recovering safely
  from absent or invalid local storage rather than throwing.
- Accessibility from the start: keyboard operation, focus management across route
  transitions, and correct landmark semantics.

## Acceptance criteria

- [ ] Each route loads as a separate chunk, confirmed in the build output
- [ ] Pasting a URL with filter and sort parameters reproduces the same view
- [ ] Hand-corrupted URL parameters produce a clear fallback rather than a crash
- [ ] Corrupt local-storage preferences are discarded and defaults restored without error
- [ ] Preferences never change which Source Records belong to a Result Set
- [ ] The shell is fully keyboard operable and focus moves correctly on navigation
- [ ] Theme switching works and respects the design tokens from `packages/ui`

## Blocked by

- T01 Workspace foundation
- T07 Gateway GraphQL layer

## Risks

- URL state and preferences are distinct concerns and conflating them makes
  shared links leak personal display settings. Keep the boundary explicit.
- Apollo's cache should hold control-plane data only. If stream data starts
  arriving through it, the architecture has drifted.
- Route-level code splitting interacts with the worker bundle; confirm the worker
  is not duplicated into multiple chunks.
