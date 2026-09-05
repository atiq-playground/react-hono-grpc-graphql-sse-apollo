# T26 UI package primitives and TimeRange component

## Outcome

`packages/ui` gains the shadcn primitives the rewritten Explore and Overview
surfaces need and a generic, domain-free `TimeRange` compound component whose
presets are supplied by the caller.

## Scope

- Add shadcn primitives to `packages/ui/src/components/ui/`: `toggle-group`,
  `popover`, `calendar`, `badge`, `skeleton`, `tooltip`. `calendar` requires
  `react-day-picker`, a new dependency; confirm at ticket time before adding.
- `packages/ui/src/components/time-range/`: compound `TimeRange` with
  `TimeRange.Root`, `TimeRange.Presets`, and `TimeRange.Custom`. Presets are
  passed as `{ value, label }` props; `Custom` renders a popover with a
  calendar range picker. The component knows nothing about `publishedAt`,
  CVEs, or the dashboard.
- Export the new primitives and `TimeRange` from `packages/ui/src/index.ts`.
- Keyboard operation, focus management, and reduced-motion behavior inherited
  from Radix and preserved through any wrapper.
- No GraphQL, routing, domain constants, or app imports in `packages/ui`.

## Acceptance criteria

- [ ] `packages/ui` typechecks and exports `ToggleGroup`, `Popover`, `Calendar`, `Badge`, `Skeleton`, `Tooltip`, and `TimeRange`
- [ ] `TimeRange` renders presets from props and emits `onChange` with either a preset value or a custom `{ from, to }` pair
- [ ] The presets toggle is operable with arrow keys and the custom popover traps and returns focus correctly
- [ ] No file in `packages/ui` imports from `apps/*` or references `publishedAt`, `kaiStatus`, or time-range preset identifiers
- [ ] Dark mode is driven by the existing CSS variables in `globals.css`, not by hardcoded colors

## Blocked by

None.

## Risks

- `react-day-picker` adds bundle weight; the calendar should load only when
  `TimeRange.Custom` opens if measurement shows it matters.
- A compound component that leaks domain presets is the most common way for
  `packages/ui` to acquire app knowledge. Keep presets as props.
- shadcn generator output must match the existing `components.json` aliases.
