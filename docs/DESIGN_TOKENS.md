# Design Tokens

> **Source of truth: [`packages/core/src/types/event.ts`](../packages/core/src/types/event.ts)
> (lines 12–38).**
>
> This document explains *intent and usage*. It deliberately does not restate every hex
> value as authoritative — read the code for current values. If the two disagree, the code
> is right and this file is stale.

## Where tokens live, and why there is no `theme.ts`

`docs/CLAUDE_CODE_HANDOFF.md:566` originally called for a separate
`packages/core/src/theme.ts`. **That file was intentionally not created.** `DESIGN_TOKENS`
already ships from `types/event.ts` alongside `CATEGORY_PALETTE` and `PRIORITIES`, and
splitting them across two modules would give the palette two homes and let them drift.
Import from the `@1440/core` barrel:

```ts
import { DESIGN_TOKENS, CATEGORY_PALETTE, PRIORITIES, PPM, BLOCK_SIZE, RULER_W } from '@1440/core';
```

**Never hardcode a hex value in a component.** A past bug required a sweep to remove
hardcoded `Courier New` fonts (`b1cc1e8`); the same discipline applies to color.

## Palette — `DESIGN_TOKENS`

The app is **dark mode only**. Light mode is a tracked future milestone, so tokens are
named by *role and depth*, not by lightness — a light theme would reassign the same names.

| Group | Keys | Role |
|---|---|---|
| Surfaces | `bg0` → `bg3` | Increasing elevation. `bg0` is the app background and matches `backgroundColor` in `apps/mobile/app.json`. |
| Borders | `border`, `borderHi` | Default hairline, and the emphasised/focused variant. |
| Text | `L1` → `L4` | Descending prominence: `L1` primary, `L2` secondary, `L3` muted, `L4` faintest (disabled controls, minor ticks). |
| Grid | `gridHr`, `gridQtr` | Hour lines vs. quarter-hour lines in the day grid and ruler. `gridQtr` is deliberately dimmer. |
| Accent | `amber`, `cyan` | `amber` is the brand/now accent; `cyan` is the secondary accent. |

## Categories — `useCategoryStore` and `CATEGORY_PALETTE`

Since pass 11 categories are **user data** in a persisted store, not a const. The five
built-ins (`deep`, `meeting`, `admin`, `break`, `personal`) are only the seed (`CATEGORIES`
in `types/event.ts`, deliberately not exported). A category stores:

- `color` — one `#RRGGBB`, picked from `CATEGORY_PALETTE` (twelve swatches; the first five
  are the seed colours)
- an optional `startMinute` / `endMinute` range, drawn as a faint band on the Day grid

`bg` — the same hue at **0.18 alpha**, the block fill — is **derived** by `categoryBg()`
in `utils/category.ts`; every lookup (`useCategory`, `resolveCategory`) returns it. Keeping
`bg` a translucent match of `color` is what lets overlapping blocks stay legible against
the grid; the derivation makes that relationship impossible to break.

Category colors are also the source for watch-face event arcs — `buildWatchSnapshot()`
resolves `categoryId` → hex when assembling the snapshot
(`apps/mobile/src/services/watchSync.ts`), so a recolour propagates to the watch on the
next send and the watch never needs the category list.

## Priorities — `PRIORITIES`

Three todo priorities (`high`, `med`, `low`), each with a `color` only — used for the
priority pip in `TodoRow`. Distinct from category color; a todo shows both. The type union
lives in `packages/core/src/types/todo.ts:3`.

## Layout constants

| Constant | Value | Meaning |
|---|---|---|
| `MINUTES_IN_DAY` | 1440 | The whole premise. Minutes from midnight, `0`–`1439`. |
| `PPM` | 2.8 | **Pixels per minute** — the master scale. Day-grid height is `1440 × PPM`. |
| `BLOCK_SIZE` | 15 | Grid snap, in minutes. Drag and resize quantise to this. |
| `RULER_W` | 76 | Timeline ruler width in px; day-grid content is offset by it. |

`PPM` is the one number that rescales the entire day view — change it and block heights,
scroll offsets, the now-line and drag math all follow, because every one of them derives
from it rather than storing pixel values.

## Typography

There is no typography token set. Font sizes are currently literal values in component
styles. Consolidating them into `DESIGN_TOKENS` is unclaimed work — see `docs/STATUS.md`.
