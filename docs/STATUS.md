# Project Status

**Last updated: 2026-10-08** — read this first; it is the source of truth for project state.
The other docs describe *intent*, and some of it predates what actually shipped.

---

## TL;DR

The Expo app works and is genuinely usable: it persists data, fires punctual local
notifications, cold-starts on the Day screen, and the todo → calendar PICK flow places a
linked block. **Android watch sync is verified on hardware as of pass 6:** the
`WearableDataLayer` Expo local module on the phone writes a `WatchSnapshot` to the Wearable
Data Layer on every calendar/settings change, once a minute while the app is open, and on
foreground; `watch/android-wearos`'s `DataLayerClient` on the owner's Galaxy Watch 7
receives each one and refreshes the two complications its Watch Face Format face shows.
**Pass 7 moved the app from Expo SDK 51 to SDK 57** (React 19, RN 0.86, New Architecture
on), deleting every dependency-rot workaround. **Pass 8 finished repeat:** a series is stored
once as base event + rule and expanded at read time, "forever" exists, delete has scope
(this / this and future / all), single occurrences can be edited or removed, and the block
modal has a real date picker; the persisted store migrated to v2 on the phone. Backend, web
prototype and iOS are still scaffolding. **Pass 8.5 brought the real watch face closer to
the in-app preview:** the wall clock renders at all now, the big minute figure is computed
on the watch so it ticks without the phone, it changes colour with the count mode, and the
face shows the block you are *in* rather than "No blocks". Per-block arcs are still absent
and now have a concrete plan. **Pass 9 did the Tasks screen:** every numeric input holds
its text and coerces on blur (the duration field can finally be cleared and typed into), a
task opens in an edit sheet when its row is pressed, and todos can repeat — stored once,
with completion recorded per date. **Pass 10 added the Schedule view:** a fourth tab
listing every block from today forward, grouped by day, bounded by a 14-day window that
SHOW MORE extends — a row tap opens that day on the Day screen. **Pass 11 made categories
user data:** a fourth persisted store seeded with the five built-ins, add / edit / delete
from Settings (delete reassigns the category's blocks and tasks), one colour per category
with the fill derived from it, an optional time range per category drawn as a band on the
Day grid, and every lookup through one helper with a visible `Uncategorised` fallback.
**Pass 12a (2026-10-08, two sessions) put per-block arcs on the real watch face:** a fifth
complication data source on the watch draws one `Canvas.drawArc` per block from the
snapshot into a 450×450 bitmap, and the Watch Face Format face shows it through a
full-face `SMALL_IMAGE` slot under the ring and hand — verified on the Galaxy Watch 7 with
the owner's real blocks, exact colours, right angles. The one unknown (which image slot
type renders untinted) is settled: `SMALL_IMAGE`, and `PHOTO_IMAGE` is refused outright.
**Pass 12 (2026-10-08, evening) finished the owner's two-ring form on the watch:** the
snapshot now carries the category time ranges, and the same bitmap draws them as a thin
outer ring (one arc per ranged category, in its colour), paints the ring circle and the
96 ticks in the count-mode colour (amber / cyan, following the phone's setting for the
first time), and skips the block arcs when the snapshot is not today's — all verified on
the wrist with the owner's three ranged categories. Nineteen PRs have merged, #19 among
them (`6096689`); **five PRs are open and stacked**: `chore/sdk-upgrade` (PR #20, pass 7),
`feat/repeat-rules` (PR #21, passes 8 and 8.5, on #20), `feat/tasks-edit` (PR #22, pass 9,
on #21), `feat/schedule-view` (PR #23, pass 10, on #22) and `feat/categories` (PR #24,
pass 11, on #23), plus **two branches pushed without a PR yet**: `feat/watch-arcs` (pass
12a, on #24) and `feat/watch-category-ring` (pass 12, on `feat/watch-arcs`) — sessions can
no longer read the GitHub token; the owner opens both, bodies in the pass-12a and pass-12
logs. Merge in that order. The remaining backlog is pass 13 under **Next up**.

---

## ✅ Working

**`packages/core` (`@1440/core`)** — platform-agnostic
- Types: `CalendarEvent`, `Todo`, `RepeatConfig` (+ `exceptions`/`overrides`, `SeriesScope`),
  `Category` / `ResolvedCategory` (`CategoryId` is a plain `string` since pass 11),
  `CATEGORY_PALETTE`, `PRIORITIES`, `DESIGN_TOKENS`
- Utils: `computeLayout`, `findNextFreeSlot`, `autoScheduleQueue`, time/date helpers, and
  since pass 8 the repeat expansion in `utils/repeat.ts` — `eventsOnDate`, `datesWithEvents`,
  `expandSeries`, `occurrenceId`/`parseOccurrenceId`, `describeRepeat`,
  `migrateMaterialisedSeries`; since pass 11 `utils/category.ts` — `resolveCategory`
  (fallback `UNCATEGORISED`), `categoryBg`, `hasRange`, `describeRange`, `countCategoryUse`
  — and the hooks `useCategory(id)` / `useCategories()`
- Four zustand stores persisted via an injectable `StateStorage` adapter
  (keys `1440-planner-{calendar,todos,settings,categories}-v1`; the calendar store is at
  **`version: 2`** with a `migrate()` that folds pre-pass-8 materialised repeat rows back
  into base + rule; the category store seeds the five built-ins as its initial state and
  the row only appears in AsyncStorage after the first edit)

**`apps/mobile`** — Expo SDK 57 (React 19.2.3, RN 0.86.3, expo-router 57, New Architecture
on), four tabs
- **Day** — 1440-minute grid, now-line, long-press-to-create, long-press-drag to move,
  top/bottom resize knobs (15-min snap + haptics), date strip with month grid, swipe
  between days, delete with 4s undo, next-block countdown, day progress stats
- **Repeat (pass 8)** — a series is one stored event + `RepeatConfig`, expanded per read
  into occurrences with ids `<seriesId>:<date>`. Modes daily / weekly / every-N-days; ENDS
  Never (forever) / After N / On date. Editing an occurrence writes an override (or, with
  the WHOLE SERIES chip, the base); deleting one offers THIS BLOCK (exception) / THIS &
  FUTURE (`endDate`) / WHOLE SERIES, all undoable. Every date read in the app goes through
  `eventsOnDate()` — the Day grid, the strip dots, notifications, watch sync, the SVG
  preview and AUTO's conflict set. The block modal's DATE fields are a tappable month grid
  (`DateField` → `MonthGrid`, shared with the date strip).
- **Tasks** — backlog with AUTO ("schedule now"), AUTO-SCHEDULE ALL, and
  **PICK** (pass 4): Tasks → PICK pushes `/day?pick=<todoId>`; Day shows a placement
  banner naming the todo; long-press on a free slot creates the linked block there
  (`fromTodo`, `linkedTodoId`, todo → `scheduled`); CANCEL on the banner or any tab
  switch abandons it. All three paths share `apps/mobile/src/services/placeTodo.ts`.
  Deleting a placed block returns the todo to `pending`; UNDO re-links it.
  **Since pass 9:** `+ TASK` and a press on any row open `TodoSheet` (add / edit: title,
  notes, duration, priority, category, repeat + start date; DELETE TASK needs two taps).
  A **repeating todo** is stored once (`dueDate` + `repeat`) and shown as one row for its
  current occurrence; checking it records the date in `repeat.exceptions` and it comes
  back pending on the next rule date (`packages/core/src/utils/todoRepeat.ts`). Every
  numeric field on the phone is `NumericField` (`components/ui/`), which coerces on blur.
- **Schedule (pass 10)** — `apps/mobile/src/app/schedule.tsx` →
  `components/schedule/ScheduleList.tsx`: an agenda of every block from today forward,
  grouped by day (header = date, block count, scheduled minutes; today's header in the
  count-mode accent), each row with start time, duration, title, category chip, `↺ rule`
  for a series occurrence, `☑ from tasks` for a placed todo, a NOW tag on the running block
  and dimming for today's finished ones. Read through `eventsInRange()` over **today →
  today + 14 days**, memoised on `[events, from, to]`; SHOW MORE widens the window by 14
  each tap, so a forever rule costs exactly the days on screen. Tapping a row sets
  `selectedDate` and pushes `/day` — editing stays on the Day screen. Past days are not
  listed. No core changes.
- **Watch** — SVG watch-face *preview*, phone-side only
- **Watch sync (Android, passes 5–6)** — `apps/mobile/modules/wearable-data-layer/` (Expo
  local module, Kotlin) puts the `WatchSnapshot` JSON at Data Layer path `/1440/snapshot`.
  `apps/mobile/src/app/_layout.tsx` sends it after hydration, on every calendar change,
  when count mode / wake / sleep change, once a minute while foregrounded, and on
  foreground (store-driven sends are debounced 500 ms, so a drag is one write). The
  snapshot is always **today's**, whichever day the phone is browsing. Since pass 12 it
  also carries `ranges` — one `{startMinute, endMinute, color}` per category with a time
  range, resolved to hex at send time — and a category edit re-sends it (verified:
  adding a ranged category reached the watch in under 2 s). Verified on the Galaxy
  Watch 7: phone `putDataItem` → watch `DataLayerClient.onDataChanged` in 1.2–4 s,
  complications refreshed via `requestUpdateAll()`.
- **Categories (pass 11)** — `useCategoryStore` (`packages/core/src/store/useCategoryStore.ts`)
  holds the list; the five built-in ids are its seed, so every existing block and todo row
  kept working unchanged. Settings → CATEGORIES lists them (dot, label, range) with
  `+ CATEGORY`; a row opens `components/ui/CategorySheet.tsx`: LABEL, a 12-swatch COLOUR
  palette with a live chip preview (`bg` is derived at 0.18 alpha — one colour per
  category), TIME RANGE off / FROM–TO (`MinuteInput`, ≥ 15 min apart), SAVE, and a two-tap
  DELETE that, when the category is in use, first shows `MOVE n BLOCKS AND m TASKS TO` with
  a chip per other category (Decisions on record). The last category cannot be deleted.
  Every surface resolves ids through `useCategory()` — grid block, agenda row, task chip,
  pickers, edit-sheet header, Day banners, watch preview arcs — and an id nothing matches
  renders as grey `Uncategorised`. A category's range is drawn on the Day grid as a faint
  wash in its colour plus a 3 px strip at the far-left edge of the ruler
  (`DayGrid.tsx`, `pointerEvents="none"` like the wake/sleep shade). The watch snapshot
  resolves hex from the store at send time and re-sends when the store changes.
- **Settings** — count mode, default duration, auto-schedule buffer, notification lead time,
  wake/sleep minutes, categories (reachable only via the gear on the Day screen, not the
  tab bar)
- **Local notifications** — one reminder per block on *today*, fired `leadTimeMinutes`
  before the block starts (Settings → NOTIFICATION LEAD TIME, default 15m). Rescheduled
  on today-only calendar changes, lead-time changes, foreground, and midnight rollover;
  debounced 500 ms. Wiring lives in `apps/mobile/src/app/_layout.tsx`, scheduling in
  `apps/mobile/src/services/notifications.ts`. Exact alarms via `USE_EXACT_ALARM`
  (pass 3): measured 76 ms late on-device. **Tapping a reminder** opens Day on the block's
  date, whether the app is backgrounded or not running (`_layout.tsx` response listener +
  last-response check, gated on navigator readiness).
- **URL scheme `planner1440`** (renamed in pass 3 from the invalid digit-leading
  `1440planner`) — cold start lands on Day; `planner1440:///day` and
  `planner1440:///settings` deep links resolve.
- Persistence across restarts via AsyncStorage, with a hydration gate in `_layout.tsx`.
  **This never actually worked before pass 2** — see the 2026-09-23 session log.

---

## 🚧 Scaffolded but NOT wired

| Area | State |
|---|---|
| **Watch sync transport — iOS** | `syncIOS()` in `apps/mobile/src/services/watchSync.ts` is a `console.log` stub; no WatchConnectivity module and no iOS build path. **Android is done** — see ✅ Working. |
| **Wear OS watch face** | **Builds, installs, renders and receives live data (passes 5–6, reworked in 8.5).** `watch/android-wearos` = `:app` (`com.planner1440.app`: Data Layer listener + four complication data sources + the androidx Canvas face, which **Wear OS 6 blocks outright**) and `:wff` (`com.planner1440.wff`: the no-code Watch Face Format face that actually shows). Draws the 24 h sweep, minute hand, the minute figure and the wall clock **from the watch's own clock**; the phone supplies the count mode, the current/next block, the block list and the category ranges. **The arcs bitmap (passes 12a + 12):** `BlockArcsComplicationService` paints a full-face `SMALL_IMAGE` (slot 4, under everything) with the outer ring and 96 ticks in the count-mode colour, a thin arc per category time range on that ring, and one arc per block — amber ring/ticks and no arcs when there is no snapshot or it is not today's. The owner's two-ring form is complete. |
| **watchOS face** | Real Swift (`WatchFaceView.swift`, `WatchConnectivityManager.swift`, …) but **no `.xcodeproj` / `Package.swift` / `Info.plist`** — cannot compile. |
| **Backend** | `backend/supabase/` is three **0-byte** files. No `config.toml`, no client dependency. Directory names only. |
| **`docs/API_SPEC.md`** | Intentionally left empty — there is no backend to spec yet. |
| **Web prototype** | `apps/web/src/App.jsx` is 1370 real lines, but `index.html` and `src/main.jsx` are **0 bytes** and there is no `vite.config.js`. `npm run web` will not boot. It also does not use `@1440/core`. |

---

## 🐛 Known debt

**A native build needs several GB of free disk, and says so badly.** Pass 7's first full
SDK 57 build failed at `:app:mergeDebugNativeLibs` with `There is not enough space on the
disk` (the machine had 40 MB free of 475 GB). The first build after a dependency change also
downloads NDK 27.1.12297006 (~2.2 GB) and can fail once with `[CXX1101] NDK … did not have a
source.properties file` when the check races that download — re-running succeeds. Neither
message names the real cause. Recorded in `CLAUDE.md` → Dev commands.

**No dynamic `import()` anywhere in `packages/core`.** Metro serves a lazy `import()` as a
separate "split bundle" and builds its URL from the path relative to `apps/mobile`; for a
core file that is `..\..\packages\core\…`, which the dev server refuses (`Failed to load
split bundle`, surfaced as "Possible unhandled promise rejection"). Pass 4 hit this in
`useCalendarStore.deleteEvent` — the todo unlink silently never ran. Use static imports;
there are no cycles between the stores. Recorded in `CLAUDE.md`.

*Fixed in pass 12a (kept for context):* **the WFF face could not draw per-block arcs.**
Watch Face Format has no loop and no way to instantiate N shapes from data, and the Canvas
renderer that can is blocked by Wear OS 6. Resolved by drawing them on the *watch* in one
more complication data source (`BlockArcsComplicationService`, a `Canvas.drawArc` loop over
the snapshot in `SharedPreferences`) and showing the 450×450 bitmap through a full-face
`SMALL_IMAGE` slot emitted first in the Scene. The spike that gated it is answered:
`SMALL_IMAGE` with `SmallImageType.PHOTO` renders untinted and at exact scale on the Galaxy
Watch 7; `PHOTO_IMAGE` is refused by WearServices and never binds. **One limit to keep in
mind:** that bitmap is redrawn only on a snapshot push (`requestUpdateAll()`) or a face
reload, so only static art may move into it — the hand, sweep and figure must stay WFF.

*Half fixed in pass 12 (kept for context):* **the arcs bitmap is only as fresh as the
last snapshot.** Same root as the backgrounded resync item below: the phone pushes on
change, once a minute while foregrounded, and on foreground. `BlockArcsComplicationService`
now compares the snapshot's `date` with the watch's local today and draws ring and ticks
only when they differ (logged as `snapshot dated … -> static art only`), so yesterday's
blocks no longer sit on the face past midnight. What remains: that check runs only when
the source is *asked* to redraw — a push, a face reload — so the stale arcs stay up from
midnight until the next of those. A watch-side daily alarm calling `requestUpdateAll()`
at 00:00 would close it; not scheduled.

*Fixed in pass 8.5 (kept for context):* the minute figure used to be a number the phone's
complication sent, so it was only as fresh as the last complication update —
`UPDATE_PERIOD_SECONDS=60` never fires here (the platform clamps to ~300 s) and the phone
only pushes while its app is foregrounded, so with the app closed it could sit five minutes
behind. The face now computes it from the watch clock.

**Phone data reaches the watch face as display strings and nothing else.** Established on
the Galaxy Watch 7 in pass 8.5, at Watch Face Format version 1 *and* 2:
`[COMPLICATION.RANGED_VALUE]` and its `_MIN`/`_MAX` evaluate to `0` whatever the source
sends, and `[COMPLICATION.TEXT]` substitutes with `%s` but is not coerced by arithmetic
(`[COMPLICATION.TEXT] * 2` is `0`). So nothing on the face can be computed or branched from
a value the phone sent. The one observable bit is whether a slot has data at all, because a
`<Complication>` block does not render when its slot is EMPTY — which is how the count-mode
switch works (two slots in the same box, gating each other). Complication expressions are
also scoped to their own slot, so **nothing outside a `<ComplicationSlot>` can be styled
from phone data**: that is why the hand and the 24 h sweep stay amber in both count modes
while the centre figure changes colour. Since pass 12 the ring and the 96 ticks *do*
follow the count mode — they moved into the full-face bitmap the watch app paints, where
`countMode` from the snapshot picks amber or cyan — but the hand and sweep cannot follow,
because that bitmap only refreshes on a snapshot push and they must tick on their own.
Anything else static could take the same route; anything that moves cannot.

**`<DigitalClock>` / `<TimeText>` renders nothing on this runtime.** Silently: no parse
error, no log line, the element is simply absent. Tried `hh:mm`, `h:mm a` and `HH:mm`, with
and without `hourFormat`. This is why the face had no clock at all from pass 5 until pass
8.5. Build clock strings from `<PartText>` + `<Template>` over `[HOUR_1_12]` / `[MINUTE]`;
`[AMPM_STATE]` works too (0 = AM, 1 = PM). Recorded in the watch README.

**Watch resync stops while the phone app is backgrounded.** RN timers are unreliable in
the background, so `_layout.tsx` clears the 60 s interval on `AppState` → background and
resumes on foreground. `nextBlock` on the wrist can therefore go stale for as long as the
phone app stays closed. Two ways out: a WorkManager/AlarmManager-driven send from the
native module, or shipping block titles in `events` and letting the watch compute
current/next itself. Not started.

**A locked watch renders both complication slots as `--`.** Wear OS blanks complication
data whenever `dumpsys trust` says `deviceLocked=1` (lock icon at 12 o'clock) — the data is
in prefs and the DWF runtime still logs `[12:TEXT] "…"`, but nothing shows. adb cannot
unlock. Not a bug, but it silently invalidates any face screenshot: check `deviceLocked`
before believing one. The owner turned off the off-wrist lock and PIN at the end of pass 6,
so the test watch now renders unlocked.

**`tsc` can fail on a generated file while Metro runs.** Creating files or directories
outside `src/app` while Metro is up (pass 4's `placeTodo.ts`, pass 5's `modules/`) makes
expo-router's typed-routes watcher write backslash "routes" such as `/..\services\placeTodo`
into `apps/mobile/.expo/types/router.d.ts`, and `npx tsc -p apps/mobile` fails with
TS1005/TS1160 there. Not our code; restart Metro (it regenerates the file clean), then
re-run `tsc`. Recorded in `CLAUDE.md`.

*Fixed in pass 3 (kept for history):* the digit-leading URL scheme `1440planner` that made
every cold start land on "Unmatched Route"; reminders firing 18–61 s late without an
exact-alarm permission; reminder taps not being handled. See the 2026-09-23 pass-3 log.

*Fixed in pass 4 (kept for history):* the todo → calendar PICK flow losing its selection
on navigation; Settings ✕ / SAVE & CLOSE toasting "GO_BACK was not handled" when Settings
was the first screen; long-press inside the wake/sleep shading creating the block at the
wrong minute; deleting a todo-linked block never returning the todo to `pending`. See the
2026-09-23 pass-4 log.

**No iOS path at all.** No `ios/` directory, no `eas.json`, no EAS project id. Getting onto
an iPhone requires either a Mac for a local build or setting up EAS Build. Not started.

**Design-token stragglers in `TodoRow.tsx`.** `#34D399` (AUTO button, "on calendar" tag,
scheduled row's left border) and `#1a3d2a` (scheduled row border) are hardcoded. Neither
is a `DESIGN_TOKENS` entry — `#34D399` is the *Break* category colour, so mapping it would
tie the "scheduled" look to a category. Pass 4 mapped only the exact match (`#38BDF8` →
`C.cyan`). Adding a `success`/`green` token is the right fix; not done.

**Unimplemented settings.** `highlightConflicts` has a Settings toggle and store field but
no rendering behavior in `DayGrid`. (The repeat half of this entry — scope with no UI —
shipped in pass 8.)

**Repeat: still interval-only, and the strip dots stop at ±365 days.** `RepeatConfig.weekdays`
exists but nothing reads it (no "Mon/Wed/Fri"). `day.tsx` expands rules for the date-strip
dots over today ±365 only; the month grid can page further and those days show no dot even
when a forever rule reaches them. Both are small; neither is scheduled.

*Fixed in pass 9 (kept for context):* numeric inputs used to coerce on every keystroke
(`Math.max(5, parseInt(t) || 30)`), so the task-duration field could not be cleared or
typed into and `RepeatPicker`'s interval/count had the same bug. All four sites now use
`NumericField`, which holds the raw string and coerces on blur / submit. One consequence
to know: `MinuteInput`'s `↕ clock · …` helper line updates on commit, not per keystroke.

**A task has no undo.** The row ✕ deletes immediately (pre-existing) and the edit sheet's
DELETE TASK needs two taps (pass 9) — but neither offers the 4 s undo that blocks have.
Pass 9 lost the owner's `SdkPick` test todo to a stray tap on that button before the
two-tap guard existed; it was recreated as a plain pending todo, so its old block
(`9Hixzkg…`, 09-24) now carries a dangling `linkedTodoId`. Harmless (`unlinkEventFromTodo`
on a missing id is a no-op), but an undo toast on the Tasks screen is the right fix.

**A repeating todo's calendar link is on the base row, not per date.** If an occurrence
is placed and the day rolls over without it being checked, the next occurrence still
reads "on calendar" until that block is deleted or the row is checked (checking clears
the link). Deliberate (Decisions on record); revisit if it bites.

**The sheets' keyboard handling is Android-blind.** Both `BlockModal` and `TodoSheet` set
`KeyboardAvoidingView behavior={undefined}` on Android, so a focused field low in the
sheet (task DURATION with the full keyboard up) is covered until the keyboard is
dismissed. Pre-existing for the block modal; not fixed in pass 9.

**Dead code.** `apps/mobile/src/navigation/RootNavigator.tsx` is 0 bytes — a leftover from a
react-navigation approach abandoned for expo-router. Safe to delete.

**No tests, no lint.** No test framework and no `check`/`lint` script in any
`package.json`. Verification is manual, on-device. `npx tsc --noEmit -p apps/mobile` and
`-p packages/core` are both clean as of pass 6 (after a Metro restart — see the typed-routes
note above). The watch project has no tests either; `gradlew :app:assembleDebug
:wff:assembleDebug` is the check.

**Doc drift.** `docs/REPO_STRUCTURE.md` lists components that never existed
(`EventDetailSheet.tsx`, `TodoPlacementPanel.tsx`, `UndoToast.tsx`, `SettingsPanel.tsx`) and
a `packages/core/src/theme.ts` that was deliberately not created (see `DESIGN_TOKENS.md`).
`CLAUDE_CODE_HANDOFF.md` references a `scaffold.sh` that does not exist. Not yet corrected.

---

## Decisions on record

- **Repeating blocks become *rules expanded at read time*, not materialised rows**
  (decided 2026-09-24, before any real repeat data existed — **implemented in pass 8, PR
  #21**, exactly as below; the consumer list turned out to be six sites, see the pass-8 log).
  Today `expandRepeat()` writes N concrete `CalendarEvent`s up front, which cannot express
  "forever" and makes "cancel from here on" a bulk delete. Instead a series is stored once
  as its base event + `RepeatConfig`, and reads expand it into virtual occurrences for the
  requested date range. Consequences, all deliberate:
  - "Forever" is the *absence* of `endDate`/`count`, not a large number.
  - "Cancel from this date" sets `endDate`; "cancel all" deletes the rule. Both O(1).
  - Editing or deleting one occurrence needs per-series `exceptions: string[]` and
    `overrides: Record<date, Partial<CalendarEvent>>`.
  - A virtual occurrence needs a stable synthetic id (`${seriesId}:${date}`) for React
    keys, drag/resize and todo links.
  - **Every `events.filter(e => e.date === …)` in the tree must move to the selector** —
    `day.tsx`, `_layout.tsx` (notifications *and* watch sync), `watchSync.ts`,
    `TaskBacklog.tsx`. That list is the real cost, and it only grows.
  The rejected alternative was a rolling materialisation horizon (~90 days, extended
  lazily): less code now, but it keeps the bulk-delete semantics and silently caps
  "forever".
- **Repeating todos reuse the block rule model, with `exceptions` meaning *done dates***
  (decided 2026-09-26, before pass-9 coding). `Todo` gains `dueDate?` (the anchor,
  `YYYY-MM-DD`) and `repeat?: RepeatConfig`; both optional, so the persisted todo store
  needs no migration. A repeating todo is stored once. The backlog shows it as **one row —
  the current occurrence**: the last rule date on or before today
  (`lastRuleDateOnOrBefore()` in `utils/repeat.ts`, O(1)), or the anchor itself while it
  is still ahead. Checking that row records the date in `repeat.exceptions` and drops the
  calendar link (`status` → `pending`, `linkedEventId` cleared) so the next occurrence
  starts unplaced; unchecking removes the date. Missed occurrences are **not** tracked as
  overdue — the row always speaks for the current cycle, and yesterday's miss is simply
  gone at midnight. `overrides` is unused for todos. Placing an occurrence (AUTO / PICK)
  makes a plain block linked to the base todo id exactly as before; a todo is never linked
  to an occurrence id. Rejected: one row per outstanding rule date ≤ today (a forgotten
  daily todo becomes a wall of overdue rows), and per-date link records (a second map to
  keep consistent, for a case the block-delete unlink already handles).
- **Deleting a category reassigns its blocks and todos; an unknown id renders as
  `Uncategorised`** (decided 2026-10-07, pass 11). `CategoryId` became a plain `string`
  and the five built-in ids are the store's seed, so no persisted row migrated and the
  calendar store stayed at `version: 2`. DELETE on a category that is in use shows a chip
  row of the other categories and moves every base event, every per-occurrence override
  and every todo on it to the chosen one (`reassignCategory` on the calendar and todo
  stores, called from `useCategoryStore.deleteCategory`) before removing it; a category
  that is not in use deletes on the second tap directly; the last category cannot be
  deleted. Independently, `resolveCategory()` / `useCategory()` fall back to
  `UNCATEGORISED` (`label: 'Uncategorised'`, `color: L3`) for any id they cannot find, so a
  stray id from an old backup never renders as `undefined`. Rejected: cascading delete of
  the blocks (destroys data for a cosmetic action) and refusing to delete a category in
  use (corners the user into deleting blocks one by one first). One colour per category —
  `bg` is derived at 0.18 alpha rather than stored — so the fill/stroke relationship
  `DESIGN_TOKENS.md` describes cannot drift.
- **No `packages/core/src/theme.ts`.** `DESIGN_TOKENS` stays in `types/event.ts` so the
  palette has exactly one home. Overrides `CLAUDE_CODE_HANDOFF.md:566`.
- **Expo Go is still not the path, for a new reason.** The SDK 51 pin that ruled it out is
  gone (pass 7), but `WearableDataLayer` is a local native module, so Expo Go could never run
  watch sync. Android dev build only. Expo Go was not tried in pass 7.
- **`docs/API_SPEC.md` stays empty** until a backend exists.

---

## ➡️ Next up

The owner's feature notes (2026-09-24) are merged into this list and staged as passes.
The ordering has two hard constraints: **categories must precede the watch rings** (the
outer ring is driven by category time ranges — building the rings first means building
them twice), and **the repeat rework should land early**, while the only repeating data
in existence is disposable test data. The first constraint is moot since pass 12a: the
arcs are drawn on a Canvas on the watch, so the category ring is a few more draw calls in
the same renderer rather than a rebuild.

7. ~~**SDK upgrade off 51.**~~ **Done in pass 7** (PR #20) — SDK 51 → **57**, not the 55 the
   old handoff guessed at, because 57 is the current SDK. Dependency rot, the
   `createExpoConfig` trap and all three metro resolver workarounds are gone.
8. ~~**Repeat, finished.**~~ **Done in pass 8** (PR #21) — rule-based virtual expansion,
   "forever", cancel with scope, single-occurrence edit/delete, store migration to v2, and
   the month-grid date picker in the block modal. Cleared the repeat half of "Unimplemented
   settings".
9. ~~**Tasks.**~~ **Done in pass 9** (PR #22) — `NumericField` at all four sites,
   `TodoSheet` for add and edit (opened from a row press), and repeat on todos with
   per-date completion (Decisions on record).
10. ~~**Schedule view.**~~ **Done in pass 10** (PR #23) — SCHEDULE tab, agenda grouped by
    day over a view-bounded window (today + 14, SHOW MORE), row tap → Day on that date.
    No core changes.
11. ~~**Categories.**~~ **Done in pass 11** (PR #24) — persisted category store seeded with
    the built-ins, `CategoryId = string`, add / edit / delete in Settings with reassign on
    delete, derived `bg`, per-category time ranges drawn as bands on the Day grid, one
    lookup helper with an `Uncategorised` fallback (Decisions on record). The watch needed
    no change. The ranges are display-only today — they shade, they do not constrain
    placement or AUTO.
12. ~~**Watch face category ring + count-mode colour.**~~ **Done in pass 12**
    (`feat/watch-category-ring`, PR to be opened by the owner, stacked on `feat/watch-arcs`)
    — `WatchSnapshot.ranges` from `useCategoryStore` (`hasRange` only, hex resolved at send
    time, version unchanged); the watch bitmap draws a thin arc per range on the outer
    ring, paints the ring circle and 96 ticks in the count-mode colour (dropped from the
    WFF), returns amber ring/ticks with no snapshot and ring/ticks only when the
    snapshot's `date` is not today. Hand, sweep, dial and figure untouched. Verified on
    the wrist with the owner's three ranged categories and both count modes.
12a. ~~**Watch block arcs.**~~ **Done in pass 12a** (`feat/watch-arcs`, PR to be opened by
    the owner, stacked on #24) — `BlockArcsComplicationService` on the watch draws one
    arc per block from the snapshot into a 450×450 bitmap, shown through a full-face
    `SMALL_IMAGE` slot (4) emitted first in the Scene. Spike answered on the Galaxy
    Watch 7: `SMALL_IMAGE`/PHOTO renders untinted at exact scale; `PHOTO_IMAGE` is refused
    by WearServices. No phone changes. Verified with the owner's real blocks.

13. **12/24-hour clock setting** (scheduled 2026-09-25, when the watch face clock went
    24-hour by decision). One setting, two displays: the phone formats every time through
    `minuteToTimeStr` (`packages/core/src/utils/time.ts`), which is 12-hour with AM/PM;
    the watch face clock is `%02d:%02d` over `[HOUR_0_23]` in
    `watch/android-wearos/tools/make-watchface.ps1`. **The watch half is the catch:** a
    phone-side setting cannot reach that element — complication data is display-strings
    only (Known debt) — so it needs either the count-mode trick (two gated clock slots,
    one 12-hour, one 24-hour, and a third gate service) or a WFF `UserConfiguration` on
    the watch, which the face's own settings UI would expose but which is a second place
    to set it. Decide which before coding. `[HOUR_1_12]` and `[AMPM_STATE]` are verified.
    Small; not blocked on anything.

Not staged, deliberately:
- **A 12/24-hour dial toggle** (the *dial*, not the clock format — that is #13). On a 12-hour dial every block appears twice (the owner's
  own "possibly double stacked" note), and `WATCH_FACE_ROADMAP.md` closes by calling the
  1440-minute sweep the product's unfair advantage. Worth settling as a product question
  first — a 12-hour *hand* for clock legibility is a different, smaller feature than a
  12-hour *dial*.
- **Watch resync while the phone app is backgrounded** (Known debt) — native-side timer
  or watch-side current/next computation.
- **`syncIOS` via WatchConnectivity** — blocked on an iOS build path (no Mac, no EAS).

---

## Session log

### 2026-10-08 (late evening) — Pass 12: category ring + count-mode colour in the arcs bitmap (branch `feat/watch-category-ring`, PR to be opened by the owner, stacked on `feat/watch-arcs`)
Stacked on `ace70a2`. Both halves touched: one JS file on the phone (no native rebuild;
the 2026-09-24 install + Metro node PID 33668 served it) and the watch renderer,
generator and README. Both devices answered on their pins first try —
`192.168.1.109:5555` (watch, 44 % battery off the charger, `deviceLocked=0`, held all
session with `screen_off_timeout 1800000`, put back to `60000`) and `192.168.1.107:5555`
(phone). Disk 26.2 GB free. **One trap hit:** the phone's `adb reverse` was gone (the
list was empty), so the first cold start showed the red "Unable to load script" screen —
re-issuing `adb reverse tcp:8081 tcp:8081` fixed it; check `adb reverse --list` before
every cold start, not only after a reinstall.

**What shipped (built, installed on the watch, verified).**
- `apps/mobile/src/services/watchSync.ts` (`ce6c749`) — `WatchSnapshot.ranges`
  (`{startMinute, endMinute, color}[]`, from `categories.filter(hasRange)`, hex as
  stored), appended after the existing fields; `version` stays 1.
- `BlockArcsComplicationService.kt` (`407d716`) — three layers into the one bitmap:
  `drawStaticArt(accent)` (ring circle at `RING_R = R + R*0.125`, stroke 1.5, alpha
  `0x8C`; 96 ticks, major every 4th at 1.8 / `0xE6` from `R − R·0.06` to `R + R·0.06`,
  minor `#3D4F66` 0.6 / `0xB4` from `R + R·0.01`) in amber or cyan from `countMode`;
  `drawRange()` per range at `RING_R`, stroke 2.5, alpha 140; the block arcs as in 12a.
  Gate: no snapshot → amber static art (fresh install still has a face); snapshot
  present → always a bitmap; `date ≠ localToday()` (`yyyy-MM-dd`, matching core's
  `today()`) → static art only, logged. `getPreviewData` draws a ring and two sample
  ranges. Log line is now `drew N/M arcs, R ranges, amber|cyan ring for SMALL_IMAGE`.
- `tools/make-watchface.ps1` → `watchface.xml` — the ring and tick `<PartDraw>`s are
  gone (the Scene now has slot 4, then only the sweep and dial `PartDraw`s, the hand
  group, slots 1/3, the clock, slot 2); header comments updated. XML parses.
- `watch/android-wearos/README.md` — data-path diagram, the bitmap paragraph (all three
  layers, both gates), the scoping bullet.

**Verification.** (1) Watch listed, timeout raised, `deviceLocked=0` ✅. (2) Cold start
pushed a 10-08 snapshot: watch `Received snapshot` 1.2 s after `putDataItem ok`,
`1440_watch.xml` has `"ranges":[{240,360,#FB923C},{1080,1260,#FB923C},{405,1020,#A3E635}]`
— the owner's Personal (AM), Personal (PM) and Work — and the renderer logged `drew 1/1
arcs, 3 ranges, amber ring`. Adding a test category `RingTest` (540–1020) in Settings
re-sent within 2 s → `4 ranges`; deleting it → `3 ranges` ✅ (owner's data unchanged:
seven categories, count-up). (3) Screenshot: lime arc over 6:45–17:00 and orange over
4–6 h and 18–21 h on the thin outer ring, the 7:30 `Daily Huddle` arc cyan inside, hand,
sweep, dial, clock and figure as before. Pixels at `r = 202.5`: minute 100 (ring only)
`(119,79,13)` amber; 700 `(125,150,35)` lime-over-amber; 1170 `(187,112,38)` orange;
major tick at 3 o'clock `(199,130,11)`. After COUNT DOWN on the phone: `cyan ring`
logged, ring `(30,94,124)`, ticks `(46,154,204)`, figure `261 / MIN LEFT` in cyan; after
COUNT UP: `amber ring` again ✅. (Ring/tick samples read 10–20 % darker than the
analytic blend because a 1.5–1.8 unit stroke straddles pixels; hue is exact.) (4)
Fresh-install: `run-as rm shared_prefs/1440_watch.xml`, face reload → new process logged
`no snapshot -> static art only (amber)`, ring and ticks amber, block radius and the
Work ring segment read background, no crash; the phone's minute timer restored the
snapshot 23 s later ✅. (5) Stale-date: the wrist still held the 10-07 snapshot at the
first reload → `snapshot dated 2026-10-07, today is 2026-10-08 -> static art only`,
screenshot had ring and ticks and no arcs ✅. (6) Gradle clean; `tsc --noEmit` clean on
`apps/mobile` and `packages/core` ✅.

**Found on the way**
- **Slot 2 on the owner's favourite is bound to `CountDownComplicationService`**, not
  `NextBlock`: in count-down mode the DWF log showed `[14:SHORT_TEXT] …CountDown… "261"
  "MIN LEFT"` and a second figure appeared under the clock; in count-up it is gated
  `NO_DATA` so nothing shows. Pre-existing (slot 2 is `isCustomizable="TRUE"`, and the
  favourite's slot choice persists across reinstalls), not from this pass. Fix is on
  the watch: long-press the face → Customize → slot 2 → pick "Current or next block"
  (or remove and re-add the favourite). Left for the owner; the default-provider policy
  in the XML is right.
- `_layout.tsx`'s category subscription fires on add and delete, not only on edit
  (pass 11 said "recoloured or deleted"); confirmed by the 4-ranges/3-ranges pushes.
- The analytic pixel expectation is exact for the 4.5-wide block arcs (12a) but reads
  low for sub-2-unit strokes; sample the hue, not the magnitude, for ring and ticks.

**Commits.** `ce6c749 feat(watch-sync): category ranges in the snapshot`,
`407d716 feat(watch): category ring and count-mode colour in the arcs bitmap`, and this
docs commit. Pushed.

**PR body to paste (title `feat(watch): category ring and count-mode colour in the arcs
bitmap`), at `https://github.com/cryptomdma/1440-planner/pull/new/feat/watch-category-ring`:**
> Stacked on `feat/watch-arcs` (merge after it, which is after #24). Finishes the
> two-ring form on the real watch face. **Phone (JS only):** `WatchSnapshot` gains
> `ranges` — one `{startMinute, endMinute, color}` per category with a time range, from
> `useCategoryStore`; appended after the existing fields, so an older watch build is
> unaffected and `version` stays 1. **Watch:** `BlockArcsComplicationService` now paints
> three layers into the slot-4 bitmap — the outer ring circle and 96 ticks in the
> count-mode colour (amber up, cyan down; same geometry the WFF `<PartDraw>`s had, which
> are removed from the generator), a thin arc per category range on that ring, and the
> block arcs as before. Gate: no snapshot → ring and ticks in amber; snapshot present →
> always a bitmap; snapshot `date` ≠ the watch's today → ring and ticks only (closes the
> midnight-staleness debt item). The sweep, hand, dial and figure stay WFF because the
> bitmap only redraws on a push. Verified on the Galaxy Watch 7 with the owner's three
> ranged categories: `drew 1/1 arcs, 3 ranges, amber ring`, ring pixels amber / lime /
> orange where expected, cyan ring and ticks after COUNT DOWN and amber after COUNT UP,
> fresh-install and stale-date paths logged and screenshotted, a category add/delete
> re-sent 4 then 3 ranges; Gradle and both `tsc` runs clean. Not in this PR: slot 2 on
> the owner's favourite is user-bound to CountDown (pre-existing; fixed on the watch).

**Not done / caveats**
- No PR number yet (above); the arcs PR before it may not be open either.
- The stale-date check only runs when the source is asked to redraw (push or reload);
  a 00:00 watch-side alarm would make it immediate — Known debt.

### 2026-10-08 (evening) — Pass 12a resumed: spike run, arcs verified on the wrist (branch `feat/watch-arcs`, PR to be opened by the owner, stacked on #24)
Same branch, two more commits on top of `0253d81`. Watch-only; no phone JS, no phone
rebuild; Metro (node PID 33668) and the phone (`192.168.1.107:5555`) left alone. Disk
26.8 GB free. **The watch was reachable this time, on a new address:** it had rebooted
since the morning (uptime 21 h at 19:18), came up on DHCP lease `192.168.1.109` with a
wireless-debugging port (`:36541`, auto-listed by mDNS as `offline`), and a disconnect +
connect pair brought it to `device` on the second try. Re-pinned with `tcpip 5555` →
**`192.168.1.109:5555`**; `KEYCODE_WAKEUP` + `screen_off_timeout 1800000` in the same
call; `deviceLocked=0`; 36 % battery, off the charger, and it held for the whole session
(put back to `60000` at the end).

**Spike result (19:19, screenshot zoomed, pixels sampled with `System.Drawing`):**
- Slot 4 `SMALL_IMAGE` (`SmallImageType.PHOTO`): **renders untinted and at exact
  full-face scale.** Pixels at the block radius read `(255,0,0)`, `(0,255,0)`, `(0,0,255)`
  at 7 h, 13 h, 19 h — the probe's exact hues, no tint, no letterboxing — and the ring,
  ticks, sweep and hand drew over them (the hand at 19:20 crossed the blue 18–20 h arc on
  top). Logcat: `1440:BlockArcs: spike pattern for SMALL_IMAGE` then
  `DWF:WearComplicationProvider: [11:SMALL_IMAGE] …BlockArcsComplicationService`.
- Slot 5 `PHOTO_IMAGE`: **never binds.** WearServices logs
  `[ComplicationPackageChecker] Unexpected complication data type PHOTO_IMAGE` on every
  activation, the favourite's slot 12 has `providerComponent=null`, the runtime reports
  `[12:NOT_CONFIGURED]`, and no `spike pattern for PHOTO_IMAGE` line ever appears. The inner
  radius sampled background `(7,9,15)`. So the answer is SMALL_IMAGE, decisively.

**What shipped (built, installed on the watch, verified).**
- `BlockArcsComplicationService.kt` — `SPIKE = false`, `IMAGE_TYPES = {SMALL_IMAGE}`,
  `wrap()` builds only `SmallImageComplicationData` (the `PhotoImageComplicationData`
  branch and import are gone), `spikeBitmap()` kept as the one-pattern probe with the
  result written into its doc comment.
- `AndroidManifest.xml` — `SUPPORTED_TYPES` is `SMALL_IMAGE` only, with the reason.
- `tools/make-watchface.ps1` → `watchface.xml` — `$imageSlots` is slot 4 alone; the
  header comment no longer says arcs are impossible. The XML parses and lists slots 4, 1,
  3, 2, which the runtime logs as `[11]`…`[14]`.
- `watch/android-wearos/README.md` — module table, data-path diagram, the arcs paragraph
  (now a description, not a plan), two new runtime findings (image slots; what may and may
  not move into the bitmap), slot renumbering.

**Verification.** (1) `adb devices` lists `192.168.1.109:5555`, timeout 1800000,
`deviceLocked=0` ✅. (2) Spike screenshot as above ✅. (3) Renderer with the real snapshot
on the wrist (dated 2026-10-07: `Daily Huddle` 450/15 `#38BDF8`, `Pick up trucks` 540/60
`#A3E635`): logcat `1440:BlockArcs: drew 2/2 arcs for SMALL_IMAGE`; sampled pixels at
minute 457 → `(41,136,178)` and at 570/595 → `(115,163,42)`/`(116,164,41)`, against the
computed 0.7-alpha blends `(41,135,178)` and `(116,164,42)` over the `#07090F` background;
minutes 440, 470, 530 and 610 (just outside each block) read background ✅. (4) A face
switch away-and-back re-queried the source (`requestUpdateFromProvider … BlockArcs` →
`drew 2/2` → `[11:SMALL_IMAGE]`); no phone push happened this session (the phone app was
not foregrounded, snapshot still dated 10-07) ✅ via the face-switch path. (5) One figure:
`[12:SHORT_TEXT] CountUp "1163" / "MIN ELAPSED"`, `[13:NO_DATA]` for CountDown; slot 2
empty because the 10-07 snapshot has no next block at 19:23 — correct ✅. (6) Gradle clean
(24 s cold daemon, 11 s warm); `tsc --noEmit` clean on `apps/mobile` and `packages/core` ✅.
No `TransactionTooLargeException` anywhere in the capture.

**Found on the way**
- The watch's address is not stable across reboots either (`.68` → `.109`); after a
  reboot it shows up in `adb devices` on its own as an `offline` mDNS entry with a
  wireless-debug port — `adb disconnect` + `adb connect` on *that* entry is enough, no
  pairing code was needed this time. Try that before asking the owner.
- Because the bitmap refreshes only on a push or a face reload, the arcs will show a stale
  day after midnight with the phone app closed (the snapshot on the wrist is still
  yesterday's). Recorded under Known debt; the two-line `date` check belongs in #12.
- Moving the ring/ticks/hand into the bitmap for count-mode colour, which the handoff
  offered as a stretch, was **not** done: the hand and sweep must tick on their own and the
  bitmap cannot, so only the static art qualifies — folded into #12 with that constraint
  rather than half-done here.

**Commits.** `4a835bc` (the spike) is **kept**, not squashed — its message says what it
was and the probe result is the useful history. New: `feat(watch): block arcs drawn into
a full-face image complication` and this docs commit.

**PR body to paste (title `feat(watch): block arcs drawn into a full-face image
complication`), at `https://github.com/cryptomdma/1440-planner/pull/new/feat/watch-arcs`:**
> Stacked on `feat/categories` (#24); merge after it. Watch-only: no phone changes.
> Today's blocks now appear as coloured arcs on the real Galaxy Watch 7 face. WFF has no
> loop, so `BlockArcsComplicationService` (new, in `app/`) runs the `Canvas.drawArc` loop
> on the watch over the snapshot already in `SharedPreferences` — one arc per block in the
> hex colour the phone resolved, 0.7 alpha, at the preview's radius — and returns a
> 450×450 bitmap as a `SMALL_IMAGE` (`PHOTO`); `NoData` when there is nothing to draw. The
> WFF face gains `slotId="4"`, a full-face `isCustomizable="FALSE"` slot emitted first in
> the Scene so ring, ticks, sweep and hand draw over it; `DataLayerClient` re-requests it
> on every snapshot. Spike (first commit) answered on-device: `SMALL_IMAGE` renders
> untinted at exact scale, `PHOTO_IMAGE` is refused by WearServices — so only
> `SMALL_IMAGE` ships. Verified with the owner's real blocks: `drew 2/2 arcs`, sampled
> pixels match the expected blends, one count figure, slot 2 unchanged; Gradle and `tsc`
> clean. Known limit (documented): the bitmap refreshes on push/reload only, so with the
> phone app closed it can show yesterday's arcs after midnight — date check slated for #12.

**Not done / caveats**
- No phone-push refresh observed this session (phone app not foregrounded); the
  face-switch path, which calls the same `requestUpdateAll()`, was.
- Count-mode colour of the ring/ticks and the category ring: #12.
- No PR number yet (above).

### 2026-10-08 — Pass 12a: watch block arcs — renderer + probe slots written, spike NOT run (branch `feat/watch-arcs`, no PR yet, stacked on #24)
Branch `feat/watch-arcs`, **branched from `feat/categories` (`788c4f8`), not `main`** —
`main` was still at #19 with #20–#24 open. Watch-only; no phone JS, no phone rebuild;
Metro (node PID 33668) left alone. Disk 26.9 GB free. **The watch was unreachable for the
entire session** and that is the whole story of this pass: `adb connect 192.168.1.68:5555`
timed out on every one of ~60 attempts over 30 minutes (05:37–06:05); the watch had no ARP
entry on the LAN but was still paired to the phone over Bluetooth (`dumpsys
bluetooth_manager` on the phone lists `Galaxy Watch7 (L4GZ)`), i.e. nearby, screen off,
Wi-Fi parked — exactly the pass-8.5 state that nothing over adb revives. Tried, in order,
and none woke it: a shell notification on the phone (`cmd notification post`, probably not
bridged), a second one addressed to the owner asking for a tap, and Galaxy Wearable's
*Find My Watch* — which stopped at an *Updates to Galaxy Watch7 Privacy Notice* dialog
that only the owner should accept (backed out; the phone was left on the Settings screen it
was on). The phone itself (`192.168.1.107:5555`) answered throughout.

**What shipped (built, committed, pushed, unverified on the wrist).**
- `watch/android-wearos/app/src/main/java/com/planner1440/watchface/BlockArcsComplicationService.kt`
  — a fifth complication data source. Reads the snapshot's `events`, draws one
  `Canvas.drawArc` per block into a 450×450 `ARGB_8888` bitmap (radius `r − r·0.2 = 144`,
  stroke 4.5, butt caps, alpha 0.7, `startAngle = start/1440·360 − 90`), parses the hex
  `color` the phone resolved, and wraps it as `SmallImageComplicationData` with
  `SmallImageType.PHOTO` for a `SMALL_IMAGE` request or `PhotoImageComplicationData` for a
  `PHOTO_IMAGE` one. No snapshot, no events, or nothing drawable → `NoDataComplicationData()`
  (never null). `getPreviewData` draws the four sample arcs from `make-preview.ps1`.
  **`const val SPIKE = true`** short-circuits every request into the probe: red / green /
  blue arcs at 6–8h, 12–14h, 18–20h at the block radius for `SMALL_IMAGE`; magenta / yellow
  / cyan 30 px further in for `PHOTO_IMAGE`. Logs under `1440:BlockArcs`.
- `AndroidManifest.xml` — the service registered with `SUPPORTED_TYPES`
  `SMALL_IMAGE,PHOTO_IMAGE`, `UPDATE_PERIOD_SECONDS` 0.
- `DataLayerClient.kt` — the class added to `COMPLICATION_SERVICES`, so every snapshot push
  calls `requestUpdateAll()` on it.
- `tools/make-watchface.ps1` → `wff/src/main/res/raw/watchface.xml` — two full-face slots
  emitted **first in the Scene** (under ring, ticks, sweep, hand): `slotId="4"`
  `SMALL_IMAGE` and `slotId="5"` `PHOTO_IMAGE`, both `0,0 450×450`, `isCustomizable="FALSE"`,
  `DefaultProviderPolicy … primaryProviderType="<type>"`, a `<PartImage>` over
  `[COMPLICATION.SMALL_IMAGE]` / `[COMPLICATION.PHOTO_IMAGE]`. Slots 1, 3, 2 unchanged.
- `gradlew :app:assembleDebug :wff:assembleDebug` **clean** (41 s warm); the generated XML
  parses and lists slots 4, 5, 1, 3, 2. `tsc --noEmit` clean on both phone projects (no
  phone change, run as the handoff asked).

**Verification: steps 1–5 not run** (no watch). Step 6 (build + `tsc`) ✅. Nothing was
installed on any device; the watch still runs the pass-8.5 face and app.

**Found on the way**
- **The GitHub-token recipe in the memory note is now refused by the Claude Code
  permission classifier** ("Credential Materialization") — `git credential fill` output
  cannot be read in a session, so the PR could not be opened from here. The branch is
  pushed; the owner opens the PR at
  `https://github.com/cryptomdma/1440-planner/pull/new/feat/watch-arcs` with the body
  below. Future passes should plan on that.
- `adb devices` on the phone showed two entries for `.107` (`:5555` and a wireless-debug
  `:43127`, presumably mDNS auto-connect) — harmless, always pass `-s …:5555`.
- `cmd notification post` text must not contain parentheses (the shell on the phone
  chokes on them).

**PR body to paste (title `feat(watch): block arcs drawn into a full-face image
complication — spike build, unverified`):**
> Stacked on `feat/categories` (#24); merge after it. Watch-only: no phone changes.
> Adds `BlockArcsComplicationService` (draws today's blocks as arcs into a 450×450 bitmap
> from the snapshot already in `SharedPreferences`, one `drawArc` per block in the hex
> colour the phone resolved; `NoData` when nothing to draw) plus two full-face image
> slots (4 = `SMALL_IMAGE`, 5 = `PHOTO_IMAGE`) emitted under the ring in the WFF face, and
> the service in `DataLayerClient`'s `requestUpdateAll()` list. **Left in spike mode
> (`SPIKE = true`)**: both slots show fixed three-colour probe arcs so a screenshot can tell
> which image type the Galaxy Watch 7 runtime renders untinted at full size. Builds clean;
> **not run on the watch** — it slept through the session and could not be woken over adb.
> Next session: install, screenshot, flip the constant, drop the losing slot, verify with
> the real snapshot. Category ring and count-mode colouring of the ring are still to come.

**Not done / caveats**
- Everything on-device: the spike, the renderer check, the refresh check, the count-mode
  regression check, screenshots. `screen_off_timeout` was never changed (never connected).
- Slot 5 and the `SPIKE` constant are throwaway once the probe is read; one of the two
  slots goes.
- No PR number yet (above). No memory-note recipe changes beyond recording the denial.

### 2026-10-07 — Pass 11: Categories — a persisted store, add / edit / delete, time ranges (PR #24, open, stacked on #23)
Branch `feat/categories`, **branched from `feat/schedule-view` (`f75661e`), not `main`** —
`main` was still at #19 (`6096689`) with #20–#23 open, so #24 carries all four and merges
last. JS-only (the new store is still JS), so no native build; the phone's app is still the
pass-7 install. **A new Metro** (node PID 33668, not the 61684 / 16188 earlier handoffs
named) was already on :8081 from the owner's morning session and was reused. Phone on
`192.168.1.107:5555` and watch on `192.168.1.68:5555`, both pinned that morning (memory
note). Disk **2.04 GB free at the start, 0.53 GB mid-session, 22.5 GB at the end** — the
owner was running an installer (WinGet + Inno Setup temp dirs appeared at 05:34) and then
cleared space; nothing this pass wrote, and Metro coped, but a native build during the dip
would not have.

**What shipped.** `CategoryId` is a plain `string` (`packages/core/src/types/event.ts`);
`Category` is `{ id, label, color, startMinute?, endMinute? }` with `bg` **derived** by
`categoryBg()` (0.18 alpha) and returned on `ResolvedCategory`. The five built-ins stay in
`CATEGORIES` as the **seed only** — not exported from the barrel. New
`store/useCategoryStore.ts` (`1440-planner-categories-v1`, `partialize`, `skipHydration`,
`initCategoryStorage`): `addCategory`, `updateCategory` (drops an orphaned half-range),
`deleteCategory(id, reassignTo)` which calls the new `reassignCategory(from, to)` on the
calendar store (base rows **and** per-occurrence overrides) and the todo store before
removing the row, and refuses to delete the last category. The seed is the store's initial
state and `onRehydrateStorage` re-seeds an empty persisted list, so the hydration gate never
sees a blank list. `utils/category.ts`: `resolveCategory` / `resolveCategories` (fallback
`UNCATEGORISED`, grey `L3`), `hasRange`, `describeRange`, `countCategoryUse`;
`hooks/useCategory.ts`: `useCategory(id)` / `useCategories()` (select the stable array,
resolve in a memo). The phone: `storage.ts` injects the fourth adapter and `_layout.tsx`
gates on its `hasHydrated()`, passes `categories` into `buildWatchSnapshot` and re-sends
on category-store changes. All ten `CATEGORIES.find` sites now go through the hook —
`day.tsx` (pick banner, next-block banner), `EventBlock`, `ScheduleList`, `TodoRow`,
`BlockModal` (both forms; the new-block default is the store's first category),
`watch.tsx`, `EventArcs`, `watchSync.ts`, `CategoryPicker` (maps the store, no cast),
`TodoSheet` (default = first category). `DayGrid` draws every ranged category as a faint
wash plus a 3 px strip at the far-left edge, `pointerEvents="none"`. Settings gained the
CATEGORIES section and `components/ui/CategorySheet.tsx` (TodoSheet shell): LABEL first,
12-swatch `CATEGORY_PALETTE` with a live chip preview, TIME RANGE `NONE` / `SET A RANGE`
with FROM / TO `MinuteInput`s clamped ≥ 15 min apart, ADD / SAVE, and the two-tap delete
with the reassign chip row (Decisions on record). `CLAUDE.md` and `DESIGN_TOKENS.md`
updated for the new rule.

**Verification on-device** (`192.168.1.107:5555`; screenshots in the PR)
1. Phone listed; `adb reverse` already set (`host-14`). ✅
2. Cold start on the old persisted data → Settings lists Deep Work / Meeting / Admin / Break /
   Personal (`no range`); Day on 10-07 shows `Daily Huddle` in Meeting sky-blue with the
   same `in 111m` banner as before; SCHEDULE identical (14 blocks, Meeting chips). ✅
3. `+ CATEGORY` → `Gym`, rose `#FB7185`, range 1020–1140 → row `Gym · 5:00 PM – 7:00 PM`;
   store row `{"id":"2wfNWlPh…","label":"Gym","color":"#FB7185","startMinute":1020,
   "endMinute":1140}` in `1440-planner-categories-v1`. `+ BLOCK` picker shows Gym; a
   `GymBlock` at 5:15 PM rendered rose on Day **inside the rose 5–7 PM band**, as a rose
   `Gym` chip on SCHEDULE, as a rose arc and dot on WATCH, and `GymTask` showed a rose chip
   on Tasks. Survived `am force-stop` + relaunch (Gym still listed with its range). ✅
4. Edit → lime `#A3E635` → SAVE: SCHEDULE chip lime at once, store row updated. DELETE on
   Gym (1 block, 1 task) → first tap revealed `MOVE 1 BLOCK AND 1 TASK TO` with five chips
   and `TAP AGAIN · MOVE TO DEEP WORK & DELETE`; chose Break → button re-labelled → second
   tap: Gym gone from Settings and the store, `GymBlock` row now `"categoryId":"break"`,
   `GymTask` row `"categoryId":"break"` and its chip reads Break. ✅
5. Watch snapshot: phone `1440:WatchSync putDataItem ok … (368 chars)` after the add, and
   the watch's `shared_prefs/1440_watch.xml` (`run-as`) carried
   `{"startMinute":1035,…,"categoryId":"2wfNWlPh…","color":"#FB7185"}`, then `#A3E635`
   after the recolour. The watch had gone offline once early (its screen slept between
   `connect` and the wake command) and came back on its own; timeout held at 1800000 for
   the rest of the session. ✅
6. Nothing regressed: cold start → Day **3/3**; Tasks → PICK on `GymTask` → banner → long-press
   at 6:15 AM placed a Break-green `GymTask ☑` block; SCHEDULE still lists `Daily Huddle`
   with the Meeting chip; notification quiet window — see the line under *Found on the
   way*. All test data deleted afterwards (both blocks via the sheet, the task via ✕). ✅
7. `tsc --noEmit` clean on both projects (no typed-routes trip). `expo-doctor` **20/21**:
   the one failure is *"5 packages out of date"* — `expo` 57.0.25 → ~57.0.27,
   `expo-constants`, `expo-linking`, `expo-notifications`, `expo-router` one patch each —
   upstream patch releases since 09-28, nothing this pass added. Left alone: `expo install
   --check` may touch native code and the disk was at 0.5 GB. ⚠️

**Found on the way**
- **zustand `persist` writes nothing on a first hydration that finds no stored value**
  (`node_modules/zustand/middleware.js` → `if (migrated) return setItem()`), so a store
  whose initial state is its seed has **no row in AsyncStorage until the first edit**.
  Harmless here (the seed *is* the initial state); do not read "row missing" as "not
  hydrated".
- `expo-doctor` is 20/21 for reasons outside the repo (above). Expect the next pass to see
  the same until the owner runs `npx expo install --check` on a day with disk to spare.
- PowerShell: a helper named `Type` is shadowed by the `type` alias (aliases beat
  functions). The scratch `adb.ps1` helper is `Typ` now.
- `TextInput autoFocus` in the new sheet did not raise the keyboard on one open of two;
  tap the field before typing over adb (`Kbd` says `mInputShown=true`).
- The Settings `✕` → `+ BLOCK` tap pair raced the route transition once and the second tap
  hit the date strip (Day landed on Oct 6). Wait a second after closing Settings.
- The notification quiet window: **zero** `[notifications]` lines from 05:52:52 to 05:56:50
  with the app idle on Day after the cleanup, while the watch resync fired at :54:32,
  :55:32 and :56:32 as it should. (A grep for `notify(` also matches Samsung's
  `SatelliteController …AndNotify(` spam — filter on `[notifications]`.)

**Not done / caveats**
- Ranges are **display-only**: they shade the Day grid and show in Settings; they do not
  constrain placement, AUTO, or the free-time stat, and they are not in the watch snapshot
  (Next up #12 names the field to add).
- No undo for a category delete (the reassign is the safety net), no reordering (store order
  = picker order = Settings order), no colour wheel (12 swatches), no per-category default
  duration. A deleted category's colour is gone from its blocks by design — they take the
  target's.
- `expo-doctor` 20/21 (above). No test data left on the phone from this pass.

### 2026-09-28 — Pass 10: Schedule view — agenda of blocks across days (PR #23, open, stacked on #22)
Branch `feat/schedule-view`, **branched from `feat/tasks-edit` (`c21d81a`), not `main`** —
`main` was still at #19 (`6096689`) with #20, #21 and #22 open, so #23 carries all three
and merges last. JS-only, no `packages/core` changes; Metro from pass 7 reused (node PID
61684, fourth pass on it). The phone had **moved to `192.168.1.101`** and lost its `:5555`
pin again (it was on a wireless-debugging port); re-pinned over that link. Disk 2.07 GB
free. Watch not touched.

**What shipped.** A fourth tab, SCHEDULE (`TABS` in `_layout.tsx`), routing to
`apps/mobile/src/app/schedule.tsx`, which renders
`apps/mobile/src/components/schedule/ScheduleList.tsx`: a `SectionList` of every block
from today forward, one section per day that has blocks (header: `TODAY · MON, SEP 28` in
the count-mode accent, else the date; right side `n blks · 1h 15m`). A row is start time +
duration on the left, title (monospace, as `TodoRow`) and a tag row: category chip
(`color`/`bg` from `CATEGORIES`), `NOW` on the block containing the current minute, `↺ daily
· forever` for a series occurrence (`isSeries` + `describeRepeat`), `☑ from tasks` for a
placed todo. Today's finished blocks render at half opacity. A page header shows the window
and block count; the footer is `SHOW MORE · +14 DAYS`; empty state when the window has
nothing.

**The range decision.** The list is bounded by the *view*, never by the rule: `from =
today()`, `to = from + days − 1`, `days` starts at 14 and SHOW MORE adds 14 (component
state, so it resets to 14 on remount — deliberate; there is no "jump to date"). One
`eventsInRange(events, from, to)` per render, memoised on `[events, from, to]`, sorted by
date / start / title and grouped by the occurrence's *display* date, so an override that
moved an occurrence lands under the right day. `useCurrentMinute()` drives the NOW tag and
rolls `today()` — and with it the whole window — at midnight. **Past days are not listed**
(the Day screen's strip already covers them); that is a product choice, not a limitation.

**Row tap.** `setSelectedDate(occ.date)` then `router.push('/day')`. The Day grid scrolls
to "now" on today and to midnight elsewhere on mount, so nothing more is needed. The
agenda deliberately does not open `BlockModal`: the edit / delete-with-scope / undo
plumbing lives in `day.tsx` and navigating there is the whole feature.

**Verification on-device** (`192.168.1.101:5555`; screenshots in the PR)
1. Phone listed after the re-pin. ✅
2. SCHEDULE is the fourth tab and opens the list. Today's section first with the owner's
   own data: `Daily Huddle` 7:30 AM `↺ daily · forever`, `SdkPick` 8:00 AM and `NumEdit`
   8:45 AM both `☑ from tasks`. `MigSeries` shows on **no** day, as the handoff predicted
   for a session after 09-26 (`count: 4` from 09-25 with 27/28 excepted). The `RepPick` /
   `PickTest` blocks are on 09-24/25 — past, so not listed; the badge was instead verified
   on the block the PICK regression placed (step 5). ✅
3. **A forever rule stays bounded.** Used the owner's real `Daily Huddle` (daily · forever
   from 09-28) instead of creating and deleting a test series — same code path, no risk to
   their data. Window 14 → 28 → 42 → 56 days over three SHOW MORE taps: header `Mon, Sep 28
   → Sun, Oct 11 · 16 blocks` → `… → Sun, Nov 22 · 58 blocks` (56 daily + 2), the series
   under every day. PSS **522 → 575 → 592 → 596 MB** — the first step is the list's own
   rows appearing, then it flattens. ✅
4. Row tap: `NumEdit` (today) → Day on `Mon, Sep 28`, grid on now (3–7 AM visible at
   05:18); `Daily Huddle` under `WED, SEP 30` → Day on `Wed, Sep 30`, strip highlighted,
   TODAY button shown, grid at 12:00 AM. ✅
5. Nothing regressed: cold start → Day **3/3**. Tasks: `NumEdit` still `↺ daily · forever`.
   PICK flow on `PickTest` (unchecked to PENDING first): PICK → `PLACING · LONG-PRESS A
   FREE SLOT` banner → long-press at 4:00 AM → block `_5m_3oNk…` (`fromTodo`,
   `linkedTodoId`), todo `scheduled`, and SCHEDULE listed it at once as `4:00 AM · PickTest
   · ☑ from tasks` (17 blocks); DELETE BLOCK → todo `pending`, block gone; re-checked done.
   Notification quiet window: **zero** `[notifications]` lines from 05:23:12 to 05:25:44
   with the app idle on Day, while the watch resync fired at :23:59 and :24:59. ✅
6. `tsc --noEmit` clean on both projects — the new `components/schedule/` directory did
   **not** trip the typed-routes trap this time; `expo-doctor` **21/21**. ✅

**Found on the way**
- **The tab bar's coordinates shifted again**: four tabs of 360 px each, so TASKS is now at
  x≈900 and the old (1201, 2975) lands on SCHEDULE. Memory note updated.
- **Tapping a block's title text on the Day grid does not open its sheet** — the title
  sits inside the top resize-knob band. The follow-up "sheet swipe" then scrolled the
  grid, which is how a test block briefly survived its own delete step. Tap the block's
  vertical middle and confirm the sheet's `TITLE` label is in the dump before swiping.
- The owner has real data on the phone now (`Daily Huddle`, `Kids`, `Cards`); test with
  disposable blocks only.
- `PickTest` (todo) lost its stale `linkedEventId` to the pass-4 block on 09-24 in the
  PICK round-trip — it is `done` and unlinked now, which is cleaner than before.

**Not done / caveats**
- Past days are not listed and there is no jump-to-date; SHOW MORE only extends forward.
- Row rendering is not virtualised beyond what `SectionList` does; at 56 days with one
  daily series it is 58 rows and fine, but a user with ten daily series and SHOW MORE
  pressed many times would eventually feel it — bound `days` (e.g. 90) if that ever bites.
- Test data left on the phone: unchanged from pass 9 apart from `PickTest` above. Metro
  (PID 61684) still up.

### 2026-09-26 — Pass 9: Tasks — numeric input that coerces on blur, edit-on-press, repeat on todos (PR #22, open, stacked on #21)
Branch `feat/tasks-edit`, **branched from `feat/repeat-rules` (`713eb85`), not `main`** —
`main` had taken #19 (`6096689`) but #20 and #21 were still open, so #22 carries both and
merges last. JS-only; Metro from pass 7 reused (node PID 61684, still up). Phone
`R5CY72XEJKD` answered on `192.168.1.97:5555` with the pin intact; watch not needed.
Disk 1.73 GB free at the start. `packages/core` changed (todo type, store, repeat util), so
verification used `am force-stop` + relaunch, not Fast Refresh alone.

**Numeric input (`apps/mobile/src/components/ui/NumericField.tsx`).** Owns a
`useState<string>` while focused, commits on blur *and* `onSubmitEditing`: `parseInt`,
else `fallback` (or the last committed value when no fallback is given), then `min`/`max`.
A `value` prop change from outside re-syncs the text (the quick-duration buttons). Four
sites: `MinuteInput` (min 0, max 1440, no fallback — clearing START and leaving keeps the
old minute), `RepeatPicker` EVERY (min 1, fallback 7) and OCCURRENCES (min 1, fallback 4),
and the task duration in `TodoSheet` (min 5, fallback 30). Verified keystroke by keystroke
through `uiautomator` dumps of the focused field: clear → `[]`, `3` → `[3]`, `0` → `[30]`;
empty + blur → `30`; `3` + submit → `5`; `30m` / `45m` quick buttons → the field follows.
In the block modal START `600` + submit turned the helper line into `↕ clock · 10:00 AM`.

**Edit on press.** `TodoSheet.tsx` (new) is one bottom sheet for add and edit, the
`BlockModal` pattern (Modal + backdrop + `Animated` slide + `ScrollView`). `TaskBacklog`'s
inline add form is gone; `+ TASK` opens the sheet in add mode. `TodoRow` wraps its content
column in a `Pressable` (`onPress`) — checkbox and AUTO / PICK / ✕ keep their own targets,
and all four still worked without opening the sheet. A `scheduled` todo shows a hint under
DURATION that the block already placed keeps its length. Verified: row press → sheet with
the stored values; title + notes + duration edited → row `NumEdit … 30m`, store row
`{"title":"NumEdit","durationMinutes":30,…}`, and the same after force-stop + relaunch.

**Repeat on todos** (Decisions on record, written before coding). `Todo.dueDate?` +
`Todo.repeat?`; `packages/core/src/utils/todoRepeat.ts` — `isRepeatingTodo`,
`todoOccurrenceDate`, `resolveTodo(todo, today)` → `{ status, occurrenceDate }`; the
shared rule arithmetic is `lastRuleDateOnOrBefore()` in `repeat.ts`, generic over a new
`Repeatable { date, repeat? }` (so `occurrenceIndex` is now typed on that too — no copy of
the expansion). `useTodoStore.setDone(id, done, date?)` writes the date into
`repeat.exceptions` and clears the block link. `TaskBacklog` renders `resolveTodo()`'s
view of every todo (re-rendered by `useCurrentMinute()` so the row rolls over at midnight)
and passes the base row to the sheet. `placeTodo.ts` is untouched: AUTO/PICK still create a
**plain** block with `linkedTodoId` = the base todo id.

**Verification on-device** (store excerpts read with the `run-as … cat RKStorage` recipe)
1. Phone listed on `192.168.1.97:5555`. ✅
2. Numeric input as above, at all four sites. ✅
3. Edit on press as above; persisted across force-stop. ✅
4. Repeat: `NumEdit` → REPEAT → Daily → SAVE → row `↺ daily · forever` under PENDING, store
   `"repeat":{"mode":"daily","interval":7},"dueDate":"2026-09-26"` (the stray `interval: 7`
   is the picker's known habit; `repeatInterval()` ignores it for daily). Checkbox → row
   under DONE, store `"exceptions":["2026-09-26"]`, `status` still `pending`; uncheck →
   `exceptions` gone. The compiled util, run under node against that exact row: 09-26 →
   `done`, **09-27 → `pending`**, 09-25 (before the anchor) → the anchor's occurrence;
   weekly and `count` cases as designed. PICK → banner → long-press 10:15 PM → plain block
   `a4Iyx…` (`fromTodo`, `linkedTodoId` = base id), todo `scheduled`; DELETE BLOCK → todo
   `pending`, link cleared, zero `NumEdit` events. ✅
5. Cold start → Day **3/3**. `MigSeries` row byte-for-byte as pass 8 left it (base 09-25,
   `count 4`, override 09-26 = 30m, exceptions 27/28) and the Day grid on 09-26 showed
   `1 blk · 30m sched`. Notification quiet window: **zero** `[notifications]` lines from
   21:42:15 to 21:46:06 with the app idle on Day (logcat cleared after the launch
   resync), while the 60 s watch resync fired three times — the loop is not repeating. ✅
6. `tsc --noEmit` clean on both projects, **`expo-doctor` 21/21**. ✅

**Found on the way**
- **A blind tap deleted the owner's `SdkPick` todo.** The Enter key on the numeric keypad
  closes the keyboard, so the "dismiss keyboard" tap at the chevron's coordinates landed
  on ADD TASK, and a later one landed on DELETE TASK in an edit sheet the previous tap had
  opened. Two consequences: DELETE TASK now needs two taps (`TAP AGAIN TO DELETE`), and
  the adb recipe is "check `dumpsys input_method` → `mInputShown` before tapping where the
  keyboard was". `SdkPick` was recreated as a pending todo (new id); Known debt records
  the dangling link on its old block.
- The task sheet's DURATION field sits under the full keyboard when TITLE has focus
  (`KeyboardAvoidingView behavior={undefined}` on Android, same as `BlockModal`) — Known
  debt, not fixed.
- The `↕ clock` helper line now updates on commit rather than per keystroke; deliberate.

**Not done / caveats**
- Task delete still has no undo toast (Known debt).
- `RepeatPicker` writes `interval: 7` next to non-custom modes when the user passes through
  Custom; harmless since pass 8, still untidy.
- Test data on the phone: `NumEdit` (daily · forever, pending, anchored 09-26), recreated
  `SdkPick` (pending, unlinked), plus everything pass 8 left. Metro (PID 61684) still up.

### 2026-09-25 — Pass 8.5: watch face parity — the clock, a live figure, count-mode colour (same PR #21)
Asked for after pass 8, on the same branch `feat/repeat-rules`: the owner noticed the real
face shows no blocks while the in-app preview does, and asked for count-mode colour,
accurate block alignment and "most importantly the real time display in the center".
Watch-side only; the phone app and `packages/core` are untouched.

**Why no blocks: the two renderers are not the same thing.** The in-app Watch tab is React
Native SVG (`WatchCanvas.tsx`) and loops over events. The face on the wrist is Watch Face
Format, a static declarative scene with no loop and no way to instantiate N shapes from
data, and the Canvas renderer that *can* draw arcs is blocked by Wear OS 6 here (pass 5).
So the arcs were never built, not broken — the generator's own header said so. The snapshot
pulled off the watch mid-session had all three of the day's blocks with start, duration and
hex colour, so the data has been on the wrist all along. Plan in Next up #12a.

**Three more defects found by screenshotting the live face**, all now fixed:
- **The wall clock had never rendered.** `<DigitalClock>`/`<TimeText>` produces nothing on
  this runtime, silently — no parse error, no log line. Tried `hh:mm`, `h:mm a`, `HH:mm`,
  with and without `hourFormat`. A `<PartText>` + `<Template>` over `[HOUR_1_12]` /
  `[MINUTE]` renders fine, and `[AMPM_STATE]` resolves (0 = AM, 1 = PM), so the clock is
  built that way with AM/PM as two labels picked by alpha.
- **Slot 2 said "No blocks" while a block was running.** It read only `nextBlock`, ignoring
  the `currentBlock` the snapshot carries. Now prefers the current block, and the title and
  time qualifier are separate fields rendered on two lines.
- **The minute hand struck through the figure** and a centre dot sat on the label. The hand
  is now drawn before the centre dial, so the dial hides its inner half and it reads as a
  pointer; the dot is gone and the dial is laid out figure / label / clock.

**The headline figure is computed on the watch now.** It used to be a number the phone's
complication sent, so it was only as fresh as the last complication update —
`UPDATE_PERIOD_SECONDS=60` never fires here and the phone only pushes while its app is
foregrounded, so with the app closed it could sit five minutes behind. The face computes
`[HOUR_0_23] * 60 + [MINUTE]` itself and ticks every minute unaided.

**Getting the count mode across took four probe builds and is the finding worth keeping.**
On this runtime **complication data reaches a WFF face as display strings only**:
`[COMPLICATION.RANGED_VALUE]` and its `_MIN`/`_MAX` evaluate to `0` whatever the source
sends (checked at format version 1 *and* 2, with the value rendered on-screen to be sure),
and `[COMPLICATION.TEXT]` substitutes with `%s` but is not coerced by arithmetic —
`[COMPLICATION.TEXT] * 2` is `0` too. So no number and no branch can come from the phone.
What *is* observable is whether a slot has data: a `<Complication>` block does not render
when its slot is EMPTY. Hence `CountUpComplicationService` and
`CountDownComplicationService`, which return data only in their own mode and `null` in the
other, on two slots sharing one box — each with its own live expression and its own colour.
Complication expressions are scoped to their slot, so the ring, ticks and hand cannot be
styled from phone data and stay amber in both modes; finishing that needs the full-face
slot that #12a introduces anyway.

**Verification on the Galaxy Watch 7** (screenshots and logcat in the PR)
1. Face active as `DeclarativeWatchFaceRuntime0`, `deviceLocked=0`. ✅
2. Clock renders — `9:43 PM` at first, `22:41` after the 24-hour decision below. It had
   been absent since pass 5. ✅
3. Figure live on the watch, count-down: **`137` in cyan** with `MIN LEFT`. ✅
4. Gating correct: `[11:NO_DATA] NoDataSource` for the count-up slot while
   `[12:SHORT_TEXT] …CountDownComplicationService` carries data. Exactly one figure on
   screen. ✅
5. Slot 2: `[13:TEXT] "NOW Test text is t"` / `[13:TITLE] "till 9:45 PM"` while that block
   was running — the case that used to read "No blocks". ✅
6. `gradlew :app:assembleDebug :wff:assembleDebug` clean throughout. ✅

**The bug the owner found an hour later, and the two checks it made possible.** With the
watch back on its charger the owner saw **both figures on screen at once, whatever the
phone said**. Cause: the idle gate returned `null`, which the complication system reads as
"no change", so after the first mode flip the slot kept its last data. It now returns
`NoDataComplicationData()`, which clears the slot. That reconnection also let the two
checks the sleeping watch had blocked run:
7. **Flip, both directions.** Day screen ▲ → `1440:DataLayer: Received snapshot` →
   `[11:SHORT_TEXT] …CountUp…` + `[12:NO_DATA]`, face **`1358 MIN ELAPSED` in amber**, one
   figure. ▼ → `[11:NO_DATA]` + `[12:SHORT_TEXT] …CountDown…`, face **`82 MIN LEFT` in
   cyan**, one figure. Phone left on count-down as found. ✅
8. **Ticks unaided.** `am force-stop` on the phone (`pidof` empty), watch captured at
   22:38:46 → `82`, and at 22:41:04 → `79`; in between **zero** `1440:DataLayer` lines and
   **zero** complication requests. The figure advances from the watch clock alone. ✅
9. **Clock is 24-hour** by decision: `22:41` where the preview would say 10:41 PM. The
   AM/PM pair is gone; a 12/24 setting is Next up #13. ✅

**Also**
- WFF format version was bumped to 2 and put back to 1: it changed nothing about the
  numeric expressions, so the extra minSdk was not worth keeping.
- The runtime renumbers slots in its logs — our `slotId` 1, 3, 2 appear as `[11]`, `[12]`,
  `[13]` in declaration order.
- `MinuteCounterComplicationService` is kept, unused by our face, as the plain SHORT_TEXT
  number for someone else's.
- Disk is down to ~1.1 GB free after the watch builds.

### 2026-09-25 — Pass 8: repeat as rules expanded at read time, cancel with scope, date picker (PR #21, open, stacked on #20)
Branch `feat/repeat-rules`, **branched from `chore/sdk-upgrade` (`039ae4b`), not `main`** —
neither #19 nor #20 had merged (`main` still `a87dc52`), so #21 carries both and merges
last. JS-only; Metro from pass 7 reused (node PID 61684, not the 51108 the handoff named).
Phone `R5CY72XEJKD` had **rebooted**: new IP `192.168.1.97`, `:5555` pin gone, re-pinned
over its wireless-debugging port. Watch `192.168.1.68:5555` held. Disk 1.67 GB free; no
rebuild needed.

**The model** (`packages/core/src/utils/repeat.ts`, `store/useCalendarStore.ts`)
- A series is one stored `CalendarEvent` (base) + `repeat`. Reads expand it: a single date
  is O(1) per series (`daysBetween(base.date, d) % interval`, then `count`/`endDate`/
  `exceptions`/`overrides`), a range is O(days / interval). Occurrence id
  `<seriesId>:<date>`, split on the last colon.
- `RepeatConfig` gained `exceptions: string[]` and `overrides: Record<ruleDate,
  RepeatOverride>`; an override may carry `date` (moves one occurrence, keeps its key).
- `repeatInterval()` derives the step from `mode` — the old modal persisted `interval: 7`
  next to `mode: 'daily'`, so trusting the stored field would have made migrated daily
  series weekly.
- Store: `updateEvent`/`deleteEvent` resolve occurrence ids (override / exception),
  `updateSeries` (also clears the patched keys from every override), `deleteSeriesFromDate`
  (`endDate = fromDate − 1`, deletes the base if nothing remains), `deleteSeries`,
  `restoreOccurrence`, `deleteWithScope`. `expandRepeat()` is gone.
- **Six consumers** moved to `eventsOnDate()`: `day.tsx` (grid + strip dots via
  `datesWithEvents()` over today ±365), `_layout.tsx` (notifications), `watchSync.ts`,
  `TaskBacklog.tsx`, `watch.tsx`, and the store's `getEventsForDate`.
- **The identity-compare trap was real and is fixed on purpose:** `_layout.tsx` now compares
  today's reminder set by `id|date|startMinute|durationMinutes|title`, not `e === b[i]`.
  Measured: one `[notifications]` line in a 2.5-minute quiet window with two repeating
  blocks on today.

**Migration.** `version: 2` + `migrate()` (runs inside `rehydrate()`). Groups rows by
`seriesId`, earliest = base, walks the rule to the last surviving row (`count`), missing
dates → `exceptions`, differing fields → `overrides`, stray dates → standalone events; rows
without `seriesId` untouched. **The phone had no materialised series** (13 plain events),
so `MigSeries` (daily × 4) was created on the old build and its 09-27 row deleted first.
After one cold start: one row, `{"mode":"daily","count":4,"exceptions":["2026-09-27"]}`,
`"version":2`, the 13 others byte-identical.

**UI.** `MonthGrid` extracted from `DateStrip` and shared; `DateField` (tap → grid) replaces
both bare `YYYY-MM-DD` inputs in `BlockModal`. `RepeatPicker`: ENDS Never / After N / On
date (Never default → forever), `startDate` prop seeds "until". Edit sheet on an
occurrence: rule badge, EDITS APPLY TO chips (THIS BLOCK / WHOLE SERIES; date is always
per-occurrence), and DELETE THIS BLOCK / THIS & FUTURE / WHOLE SERIES, each undoable
(the undo entry holds a `restore` closure). `BlockModal.onDelete` is now `(id, scope)`;
`onUpdateSeries` is new. `CLAUDE.md` → Conventions gained "never filter `events` by date".

**Verification on-device** (excerpts in the PR)
1. Both devices listed. ✅
2. Migration as above; `OtherDay3`/`PickTest`/`Test1`/`SdkNotif`/`SdkWatch` still on 09-24.
   `SdkPick` is **on calendar**, not pending — the owner placed it on 09-25 between
   passes. ✅
3. Forever: `"repeat":{"mode":"daily"}`; October fully dotted, Oct 25 shows the occurrence;
   PSS 593 → 620 MB over the grid open, flat after. ✅
4. Scope: THIS & FUTURE from Oct 25 → `"endDate":"2026-10-24"` (Oct 1–24 dotted, 25–31 not,
   survives force-stop); WHOLE SERIES from today → zero rows after force-stop. (The first
   attempt targeted Sep 28 but the grid-cell tap 1 s after a month change did not register —
   adb timing, not app logic; 2 s settle fixed it.) ✅
5. One occurrence: 30m quick button on Sep 26 → `"overrides":{"2026-09-26":{"durationMinutes":30}}`;
   DELETE THIS BLOCK on Sep 28 → `"exceptions":["2026-09-27","2026-09-28"]`; siblings 60m
   after force-stop. ✅
6. Cold start → Day 4/4. Notification, lead 0, block 20:09: `origWhen=2026-09-25
   20:09:00.000 window=0 exactAllowReason=policy_permission`, broadcast 20:09:00.004 →
   `notify(` 20:09:00.038 (**34 ms**). PICK: `RepPick` placed 7:15 PM, deleted → PENDING.
   Watch: `putDataItem ok` 20:06:44.727 → `Received snapshot` 20:06:48.429 → `[12:TEXT]
   "Forever 8:09 PM"` — **a repeating block as `nextBlock`**, 3.7 s over Bluetooth. ✅
7. Notification loop: one `[notifications]` line 20:06:44 → 20:09:20; watch resync at
   :07:07 / :08:07 / :09:07 unchanged. ✅
8. `tsc` clean on both projects (no typed-routes trap this time, even though three files
   were created while Metro ran); `expo-doctor` **21/21**. ✅

**Found on the way**
- The phone's `:5555` pin does not survive its reboot (known) *and* the IP moved (`.91` →
  `.97`); `adb devices` showed it on a wireless-debugging port. `tcpip 5555` over that link
  re-pins it — memory note updated.
- A LogBox "Open debugger to view warnings" toast (from the previous JS session) sat over
  the `+ BLOCK` FAB and swallowed the first tap.
- Month-grid cells take `input tap` (the strip's FlatList still does not), but need ~2 s
  after opening / paging before a tap lands.

**Not done / caveats**
- `weekdays` still unused; strip dots limited to ±365 days (Known debt).
- `RepeatPicker`'s interval/count inputs keep the coerce-on-keystroke bug — pass 9.
- Test data on the phone: `MigSeries` (daily × 4 from 09-25; 26th = 30m; 27/28 excepted),
  pending `RepPick` todo. `Forever` deleted in step 4.
- Metro (PID 61684) left running on :8081.

### 2026-09-24 — Pass 7: Expo SDK 51 → 57 (PR #20, open, stacked on #19)
Branch `chore/sdk-upgrade`, **branched from `fix/watch-arc-rotation` (`96db36c`), not
`main`** — PR #19 was still unmerged, so #20 contains #19's commits and should be merged
after it. Full native rebuild. Phone `R5CY72XEJKD` over `192.168.1.91:5555` the whole
session (USB never appeared); watch `192.168.1.68:5555` for step 6 only.

**Target: 57, not 55.** The pass-6 handoff proposed SDK 55 because root `node_modules` held
SDK 55 copies. That reasoning did not survive contact: those copies were an accident of
`expo-router@3.5.24`'s loose peer ranges and were deleted either way, and **57.0.25 is the
current SDK** (`npm view expo dist-tags`). 55 would have shipped an SDK two majors stale.

**Before → after**

| | before | after |
|---|---|---|
| `expo` | 51.0.39 | **57.0.25** |
| `react` / `react-native` | 18.2.0 / 0.74.0 | **19.2.3 / 0.86.3** |
| `expo-router` | 3.5.24 | **57.0.23** |
| `expo-constants` / `expo-linking` | 16.0.2 / 6.3.1 (+ **55.x** at root) | **57.0.19 / 57.0.11**, one copy |
| `react-native-screens` / `-safe-area-context` | 3.31.1 / 4.10.9 (+ **4.24.0 / 5.7.0** at root) | **4.26.2 / 5.7.0**, one copy |
| `react-native-reanimated` | 3.10.1 | **4.5.1** (+ `react-native-worklets` 0.10.1) |
| Gradle / NDK / New Arch | 8.8 / 26.1 / off | **9.3.1 / 27.1.12297006 / on** |
| packages installed | 1224 | **623** (45 → 13 vulns) |

**Deleted, as the brief asked**
- All three `apps/mobile/metro.config.js` workarounds — `nodeModulesPaths`, `blockList`,
  `resolveRequest`. The file is now `watchFolders` + `extraNodeModules['@1440/core']`, 19
  lines, monorepo only.
- The root `package.json` `overrides` block.
- `android/settings.gradle`'s `useExpoModules(exclude: ['expo-linking'])` — prebuild
  regenerates `expoAutolinking.useExpoModules()` with no exclusion and it builds.
- `babel.config.js`'s explicit `react-native-reanimated/plugin`: SDK 57's
  `babel-preset-expo` resolves and appends `react-native-worklets/plugin` itself
  (`babel-preset-expo/build/configs/expo.js:98`), so listing it would apply it twice.

**Four code changes the SDK forced — one of them silent and serious**
- **`notifications.ts:67` would have broken every reminder.** `DateTriggerInput` now requires
  `type: SchedulableTriggerInputTypes.DATE`. The old `{ date, channelId }` object **still
  typechecks** — TS allows `date` as a member of another arm of the `NotificationTriggerInput`
  union while `{channelId}` satisfies `ChannelAwareTriggerInput` — but at runtime
  `parseTrigger()` falls through every parser to the channel branch, which delivers
  **immediately**. `tsc` could not catch this; it was found by reading
  `expo-notifications/build/scheduleNotificationAsync.js`. Fixed and verified on-device
  (alarm at 23:45:00.000, not at schedule time).
- `notifications.ts:10` — `shouldShowAlert` is deprecated; `NotificationBehavior` now requires
  `shouldShowBanner` + `shouldShowList`.
- `BlockModal.tsx:367` — RN 0.86 removed `StyleSheet.absoluteFillObject` outright;
  `absoluteFill` is the same plain frozen object.
- `DateStrip.tsx:8` — `UIManager.setLayoutAnimationEnabledExperimental(true)` is a no-op that
  **warns on every launch** under the New Architecture, which was the LogBox toast. Removed.

**Two regressions the new template introduced, both fixed**
- **Edge-to-edge.** The SDK 57 Android template sets `statusBarColor`/`navigationBarColor`
  transparent and `AppTheme` to `Theme.AppCompat.DayNight`, so content drew *under* the
  status bar — the date strip sat behind the system clock (screenshot in the PR).
  `_layout.tsx` now wraps `<Slot/>` in `<SafeAreaView edges={['top']}>`. Note `day.tsx` was
  importing `SafeAreaView` from **`react-native`** (a no-op on Android) and never using it;
  that dead import is gone.
- **`userInterfaceStyle: "dark"` stopped applying.** Prebuild warned `Install expo-system-ui
  in your project to enable this feature`; with `DayNight` as the parent theme that would
  have let native widgets follow the system setting on a dark-only app. Added
  `expo-system-ui ~57.0.4` and re-ran prebuild.

**`babel-preset-expo` had to be declared explicitly.** npm nested it at
`node_modules/expo/node_modules/babel-preset-expo` (nothing conflicts — it just did), and
Babel resolves presets from `babel.config.js`'s directory, so Metro died with
`Failed to construct transformer: Cannot find module 'babel-preset-expo'`. Adding it to
`apps/mobile/package.json` (`~57.0.0`, via `expo install`) hoists it to root. `expo-doctor`
stays clean with it there.

**Verification on-device** (`R5CY72XEJKD`; screenshots and logcat excerpts in the PR)
0. `adb devices` listed phone and watch. ✅
1. `npx expo run:android` → `BUILD SUCCESSFUL`, APK 80.2 MB installed 23:28:47.
   `:expo-constants:createExpoConfig` **executed, not `UP-TO-DATE`** — and the upstream fix is
   now visible in the script itself (`outputs.upToDateWhen { false }`).
   `:wearable-data-layer:compileDebugKotlin` ran after its `android/build.gradle` was ported
   to the SDK 57 template (`plugins { id 'expo-module-gradle-plugin' }`; the old
   `applyKotlinExpoModulesCorePlugin()` form is gone). ✅
2. Cold start → Day 3/3 (`am force-stop` + launcher). Cold `planner1440:///settings` →
   Settings; ✕ → Day, no toast. **No LogBox** after the `DateStrip` fix. ✅
3. **Data survived**: `firstInstallTime=2026-05-08` (upgrade install, same debug keystore),
   `OtherDay3` still on 2026-09-24, and every setting from passes 3/6 intact (lead "At
   start", wake 360 / sleep 1320, COUNT UP, 60m, 15m buffer). `pm clear` was **not** needed;
   it remains the rollback if hydration ever breaks. ✅
4. **Notifications**: lead 0, `SdkNotif` at 23:45 → `dumpsys alarm` `origWhen=2026-09-24
   23:45:00.000 window=0 exactAllowReason=policy_permission`; broadcast 23:44:59.999 →
   `NotificationManager … notify(… channel=1440-planner` at **23:45:00.124 (124 ms)**, against
   pass 3's 76 ms bar. Then `am kill` (process gone, `pidof` empty) → tapped the card →
   cold start → **Day on Sep 24**, the block's date. ✅
5. **PICK**: Tasks → `+ TASK` `SdkPick` → PICK → placement banner → long-press a free slot →
   `SdkPick 11:15 PM · 30m` linked block, 15-min snapped, banner gone, grid did not jump.
   DELETE BLOCK → todo back under **PENDING** with its PICK button. ✅
6. **Watch sync**: `putDataItem ok … (641 chars)` 23:48:03.612 → watch `Received snapshot,
   currentMinute=1428` 23:48:04.463 → `[12:TEXT] "SdkWatch 11:55 PM"`, `[11:TEXT] "1428"`.
   **851 ms**, against pass 6's 3.5–4 s. Quiet window: phone sent 23:48:27 / 23:49:27 /
   23:50:27, watch received each ~0.7 s later — the 60 s timer is intact. `deviceLocked=0`. ✅
7. `npx tsc --noEmit` clean on `apps/mobile` and `packages/core`; **`npx expo-doctor` 21/21**. ✅
8. `metro.config.js` down to `watchFolders` + `extraNodeModules`; root `overrides` gone. ✅

**Found on the way**
- **`expo prebuild` clears `android/` even without `--clean`** when the template version
  differs, which it always will after an SDK bump. `CLAUDE.md`'s "never `--clean`" rule is
  now "back the tree up first, then diff and re-apply". Both hand edits were re-applied;
  `local.properties` (`sdk.dir=`) is *also* wiped and *not* regenerated, and without it
  Gradle cannot find the SDK (no `ANDROID_HOME` on this machine).
- Prebuild emitted `<data android:scheme="planner1440"/>` and `USE_EXACT_ALARM` from
  `app.json` unaided — pass 3's hand-fix is not needed again.
- **The machine ran out of disk** (40 MB free of 475 GB) mid-build. Reclaimed ~1.7 GB with
  `npm cache clean --force` plus the regenerable `node_modules/*/android/build` trees.
  A wider `%TEMP%` sweep was declined by the sandbox and left alone — **the disk is still
  tight (~1.5 GB) and the owner should clear it before the next native build.**
- `expo run:android --device 192.168.1.91:5555` → `Could not find device with name`; the flag
  wants a different identifier. Disconnecting the watch for the build is simpler.
- `react-dom@19.3.0` wants `react ^19.3.0` while Expo pins 19.2.3, so `npm ls react` is not
  clean. Upstream SDK 57 inconsistency, web-only, irrelevant to the Android build, and
  `expo-doctor` passes.

**Not done / caveats**
- **New Architecture is ON** (`Running "main" … "fabric":true`) and was left on —
  `DayGrid`'s long-press `locationY` maths was exercised in step 5 and is correct, so the
  `newArchEnabled: false` escape hatch was not needed.
- Expo Go still not tried, and cannot run watch sync regardless (local native module).
- `syncIOS` still a stub; per-block arcs and background resync untouched.
- Test blocks left on the phone: the pre-existing `OtherDay3` / `PickTest` / `Test1`, plus
  this pass's `SdkNotif` (11:45 PM) and `SdkWatch` (11:55 PM), and a pending `SdkPick` todo.
- Metro for the next session: a detached `cmd /c npx expo start` (node PID 51108) on :8081.

### 2026-09-24 — Pass 6 follow-up: watch-preview arcs were a quarter-turn out; backlog staged (PR #19)
Branch `fix/watch-arc-rotation`, from `main` at `a87dc52`. JS-only, no rebuild.

**The bug.** `polarToCart()` (`packages/core/src/utils/time.ts:27`) applies the −90° that
turns SVG's 0°-is-east into 0°-is-12-o'clock **itself**. Two callers subtracted it a
second time — `EventArcs.tsx:19-20` and the progress sweep in `WatchCanvas.tsx:42-43` —
so both were drawn a quarter-turn counter-clockwise, while the minute hand, the 96-tick
ring and the hour labels did their own trig and were right. On-device at 10:08 PM a
10:00 PM block sat at the 7 o'clock position instead of just left of `12A`. The owner
reported it as "mapping to a traditional 12-hour watch face"; at that hour the two errors
land close together, but it is a 90° rotation, not a 12-hour mapping.

**Root cause, not a port regression.** `apps/web/src/App.jsx:58` has the identical
`polarToCart` and the identical doubled call sites — the prototype was wrong first and the
React Native port copied it faithfully.

**Fix.** Dropped the extra −90 at both call sites, and converted the three *correct*
sites (hand, ticks, labels) to use `polarToCart` too, so the codebase has one angle
convention instead of two side by side — which is how the bug happened. `polarToCart`
now documents the convention. The same four call sites in `apps/web/src/App.jsx` were
corrected **by inspection only** (that app has 0-byte entry files and cannot boot).

**Verification.** Watch tab, 10:29 PM, three blocks (8:44 PM, 10:00 PM, 10:45 PM): all
three arcs now sit between `6P` and `12A` clustered around the hand, and the count-up
sweep's gap is at the top rather than the lower left. Before/after screenshots in the PR.
`npx tsc --noEmit` clean on `apps/mobile` and `packages/core`.

**Also.** The owner's feature notes were compared against `WATCH_FACE_ROADMAP.md` and
staged as passes 7–12 under Next up, and the repeat-model fork was decided ahead of
implementation (Decisions on record) — rule-based virtual expansion, chosen while no real
repeating data exists. Three items in those notes turned out to be existing bugs or
half-built features rather than new work: the arc rotation (fixed here), the task-duration
field that cannot be cleared (`TaskBacklog.tsx:129`, pass 9) and repeat cancellation
(`deleteSeriesFromDate` has existed with no UI since before pass 4, pass 8).

### 2026-09-24 — Pass 6: Phase 6 watch sync, part 2 — phone → watch verified, resync timer (PR #18, merged `a87dc52`)
Branch `feat/watch-sync-resync`, from `main` at `b796047` (PR #17 merged). JS-only on the
phone; no native rebuild — the pass-5 APK was installed as-is (`adb install -r`, 159 MB,
`lastUpdateTime=2026-09-24 19:25`). Phone `R5CY72XEJKD` on USB **and** `192.168.1.91:5555`
for the whole session; watch `192.168.1.68:5555`, off its charger at 100 %.

**Verified — the hop pass 5 could not exercise**
- `+ BLOCK` → `WatchProof`, today 8:15 PM, SCHEDULE BLOCK at 19:30:23. Phone
  `19:30:23.715 D/1440:WatchSync: putDataItem ok wear://f1448c68/1440/snapshot (349 chars)`
  → watch `19:30:27.197 D/1440:DataLayer: Received snapshot, currentMinute=1170` →
  `DWF:WearComplicationProvider [12:TEXT] "WatchProof 8:15 PM"`, `[11:TEXT] "1170"`,
  `[11:TITLE] "MIN ELAPSED"`. `run-as com.planner1440.app cat shared_prefs/1440_watch.xml`
  on the watch shows the real JSON where the pass-5 fake snapshot was. Same package name +
  debug certificate on both halves was the right call — GMS routed it with no pairing work.
- Delete the block → `[12:TEXT] "OtherDay3 8:44 PM"` (the next real block) 3.6 s later.
- Settings → COUNT DOWN → `[11:TEXT] "265"`, `[11:TITLE] "MIN LEFT"` in 3.5 s; COUNT UP →
  `MIN ELAPSED` again (settings are a trigger now, see below).
- Every delivery this session took 3.5–4 s phone → watch, over Bluetooth.

**Shipped — `apps/mobile/src/app/_layout.tsx`**
- The watch-sync effect is keyed on `hydrated`, not `currentMinute`, and builds the snapshot
  from `useCalendarStore.getState()` / `useSettingsStore.getState()` + `getCurrentMinute()`
  instead of the render closure. **Every trigger goes through one 500 ms trailing
  debounce** (`sendSoon`): hydration, the calendar subscription, a new settings
  subscription (`countMode` / `wakeMinute` / `sleepMinute` only), a 60 s `setInterval`
  (`WATCH_RESYNC_MS`), and `AppState` → `active`. The interval stops on background and
  restarts on foreground. The uniform debounce is deliberate: a cold start emits
  `AppState` `background` then `active` ~100 ms after the effect mounts (diagnosed with a
  temporary log), so an immediate hydration send plus a send-on-active made **two** Data
  Layer writes per launch — a "transition only" guard did not help, because it *is* a
  transition. Debouncing everything folds it into one write ~500 ms after hydration.
- **The snapshot is always `today()`'s**, not `selectedDate`'s. Before, browsing to
  tomorrow on the phone would have pushed tomorrow's blocks to the wrist.
- `RESCHEDULE_DEBOUNCE_MS` → `STORE_DEBOUNCE_MS`, shared with the notifications resync.
  `useCurrentMinute()` is still called (its re-render is what flips `todayStr` at midnight).
- `watchSync.ts`: comments only. `packages/core` untouched — no new snapshot field.
- `watch/android-wearos/README.md`: the logcat recipe was unusable (below); rewritten, plus
  the lock and screen-timeout notes.

**Verification of the timer (handoff steps 5–7, 1)**
5. Quiet window 19:36:40–19:39:10, no edits: phone sends at 19:37:30 and 19:38:30, watch
   `Received snapshot` at 19:37:33 and 19:38:33 — one a minute. `KEYCODE_HOME` at 19:39:11 →
   nothing for 80 s. Launcher relaunch at 19:40:32 → `putDataItem ok` at 19:40:32.965 (one
   send), watch at 19:40:36. ✅
6. `am force-stop com.planner1440.app` on the watch (`pidof` empty) → face switched away and
   back → both slots reloaded from prefs (`[11:TEXT] "1181"`, `[12:TEXT] "OtherDay3 8:44 PM"`);
   the next tick (19:42:36) arrived in a fresh process (pid 30351). ✅
7. `npx tsc --noEmit -p apps/mobile` and `-p packages/core` clean — after a Metro restart:
   `.expo/types/router.d.ts` still carried pass 5's `/..\..\modules\wearable-data-layer\`
   route (the stale Metro predated the `modules/` fix-up). ✅
1. Cold start against the new Metro: `Running "main"` → **one** `putDataItem ok` ~1 s later
   (hydration + the launch `AppState` pair, debounced), watch 3.5 s after that; no
   `native module missing`. Background → foreground: one send 500 ms after `active`. ✅

**Found on the way**
- **`logcat -s 1440:WatchSync` cannot work.** logcat splits a filterspec at the *first*
  colon, so `1440:WatchSync` is tag `1440` at priority `W`; the native lines never showed
  while `ReactNativeJS` did. Same for `1440:DataLayer` and `DWF:WearComplicationProvider` —
  pass 5's recipe and the watch README had it wrong. Capture unfiltered (`logcat -v time`
  to a file via `Start-Process`) and grep. Memory note and README updated.
- After `adb install -r` the app came up on the red "Unable to load script" screen —
  `adb reverse tcp:8081 tcp:8081` was gone. Re-issued.
- The watch showed `--` in both slots for most of the session because it was **locked**
  off-wrist (Known debt above) — the DWF logcat lines were the only face-side evidence.
  The owner then turned off the off-wrist lock and PIN, and a cold start at 21:44:53 gave
  the screenshot the pass had been missing: **`1305` / `MIN ELAPSED` / `PickTest 10:00 PM`**,
  matching `shared_prefs/1440_watch.xml` exactly.
- The watch went `offline` twice within a minute of connecting (60 s screen timeout →
  Wi-Fi park; off the charger, so *Stay awake while charging* did nothing).
  `input keyevent KEYCODE_WAKEUP` + `settings put system screen_off_timeout 1800000` kept it
  reachable for the rest of the session (19:26 → 20:00, off the charger). **Put back to
  `60000` at the end of the session.**
- The owner was using the phone: the GitHub app was in front for a minute and swallowed a
  whole tap sequence. Every tap sequence now checks `dumpsys window` → `mCurrentFocus`
  first and finds buttons through `uiautomator dump` instead of fixed coordinates.
- Fast Refresh of `_layout.tsx` re-runs its effects in a burst (five sends in 5 s) — a
  dev-only artefact, not a bug.

**Not done / caveats**
- The resync timer stops while the phone app is backgrounded (Known debt / Next up #3).
- `syncIOS` still a stub; per-block arcs untouched.
- The phone still carries the pass-2/3 `OtherDay3` test block on 2026-09-24; `WatchProof`
  was deleted as part of step 3.

### 2026-09-24 — Pass 5: Phase 6 watch sync, part 1 — Wear OS build + Data Layer module (PR #16, merged `a8d85ee`)
Branch `feat/watch-sync-android`. Native work on both sides. Watch: the owner's physical
Galaxy Watch 7 44mm (`SM-L310`, Android 16 / Wear OS 6) over Wi-Fi ADB — the pairing from
the previous day was still live at `192.168.1.68:44881`. Phone: `R5CY72XEJKD` was on `adb`
at the start and **gone five minutes later, for the rest of the session**. Pass-3 Metro
(PID 25108) killed as planned; a fresh detached `npx expo start` is on :8081.

**Shipped — watch (`watch/android-wearos`)**
- **A real Gradle project, two modules.** `settings.gradle`, root `build.gradle` (AGP 8.2.1,
  Kotlin 1.9.23), `gradle.properties` (JDK 17 via `org.gradle.java.home`, same line as the
  phone build), the 8.8 wrapper copied from `apps/mobile/android/`. `:app` = the Kotlin
  (`compileSdk`/`targetSdk` 34, `minSdk` 30 — the SDK has platforms 34 and 36.1 only, and
  AGP 8.2.1 cannot target a minor-version platform). `.gitignore` gained `.gradle/` and
  `local.properties`.
- **`:app` is `applicationId com.planner1440.app` and signs with a copy of the phone's RN
  debug keystore** (`app/debug.keystore`, SHA1 `5E:8F:16:06:…`). The handoff said different
  ids are fine on Wear OS 3+; the Data Layer only routes between the two halves of the
  *same* app (package name + certificate), so this is the safe choice. `namespace` stays
  `com.planner1440.watchface`.
- **Manifest** (`app/src/main/AndroidManifest.xml`): watch feature, `WAKE_LOCK`, the
  wearable `uses-library`, `standalone=false`; `WatchFaceService` with `BIND_WALLPAPER`,
  the `WallpaperService` filter + `WATCH_FACE` category, previews, and
  `android.service.wallpaper` → **`@xml/watch_face`** (a `<wallpaper/>`; the handoff's
  `watch_face_info` is the WFF descriptor and `WallpaperInfo` rejects it); the two
  complication services with `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES=SHORT_TEXT`,
  `UPDATE_PERIOD_SECONDS=60`; `DataLayerClient` exported with `DATA_CHANGED` /
  `MESSAGE_RECEIVED` + `wear://*/1440`.
- **Kotlin compile fixes** (all pre-existing): `class WatchFaceService : WatchFaceService()`
  is an inheritance *cycle* to the compiler, not a shadow — now
  `androidx.wear.watchface.WatchFaceService()`; `loadSnapshot()` used `return` inside an
  expression body (twice) — block bodies; `registerReceiver` → `RECEIVER_NOT_EXPORTED` on
  33+; `onDataChanged` skips `TYPE_DELETED` events.
- **Wear OS 6 blocks the androidx Canvas face — confirmed on the device, not a hunch.**
  Installing `:app` logs `WearServices: [WatchFacesRestrictionManagerImpl] Watch face
  (WatchFaceId[com.planner1440.app,…WatchFaceService]) is blocked` and
  `[WFInfoResolver] Blocked watch face …`; it never appears in the picker. The two
  complication data sources in the same APK are accepted (`[ComplicationsCompanionClient]
  Adding provider entry …`). Samsung's own service-based faces are exempt as system apps —
  that was the pass-4 evidence, and it does not extend to sideloads.
- **So the face is Watch Face Format: new module `:wff`** (`com.planner1440.wff`,
  `minSdk 33`, `android:hasCode=false`, `<property com.google.wear.watchface.format.version=1>`).
  `wff/src/main/res/raw/watchface.xml` is generated by `tools/make-watchface.ps1` (96 ticks
  unrolled): ring, ticks, 24 h progress sweep and minute hand from `[HOUR_0_23]*60+[MINUTE]`,
  a `DigitalClock`, and two `SHORT_TEXT` `ComplicationSlot`s whose `DefaultProviderPolicy`
  points at `com.planner1440.app/…MinuteCounterComplicationService` and
  `…NextBlockComplicationService`. The old `res/raw/watchface.xml` sketch and
  `res/xml/watch_face_info.xml` moved out of `:app` (they were never valid WFF/wallpaper XML).
  Preview/icon PNGs for both modules come from `tools/make-preview.ps1` (System.Drawing).
- **`DataLayerClient` is now the single writer.** It persists the JSON to SharedPreferences
  `1440_watch/snapshot`, calls `ComplicationDataSourceUpdateRequester.requestUpdateAll()`
  for both sources, then rebroadcasts for the Canvas renderer. Before, only the (blocked)
  renderer wrote the prefs, so on this device the complications would never have seen data.
  The renderer now loads the persisted snapshot at init instead of starting empty.
- **`MinuteCounterComplicationService`** takes the minute from the watch clock and only
  `countMode` from the snapshot (the phone's `currentMinute` is stale within a minute), and
  sets a title `MIN LEFT` / `MIN ELAPSED` that the WFF face shows under the number.
- `watch/android-wearos/README.md` written (was 0 bytes); `docs/WATCH_FACE_ROADMAP.md`'s
  "React Native Bridge" section corrected (it pointed at the gitignored `android/` tree).

**Shipped — phone (`apps/mobile`)**
- **Expo local module `modules/wearable-data-layer/`**: `expo-module.config.json`,
  `android/build.gradle` (expo-modules-core plugin + `play-services-wearable:18.2.0`),
  `WearableDataLayerModule.kt` (`Name("WearableDataLayer")`, `AsyncFunction("sendSnapshot")`
  → `PutDataMapRequest.create("/1440/snapshot")` with `snapshot_json` + a `ts` long,
  `setUrgent()`, `putDataItem`, resolves/rejects on the Task), `index.ts` via
  `requireOptionalNativeModule` so JS reloaded against an old APK gets `null`, not a crash.
- `watchSync.ts`: `syncAndroid()` calls it, keeps the `[watchSync:android] <min> min, N
  events` dev log, warns on failure, logs "native module missing" when `null`.
- **Root `.gitignore`:** the bare `android/` rule would have ignored the module's Kotlin;
  added `!apps/mobile/modules/**/android/` (verified with `git check-ignore -v`).
- Autolinking picked it up with **no edit to the hand-maintained `settings.gradle`**: the
  phone Gradle log shows `- wearable-data-layer (UNVERSIONED)` and
  `:wearable-data-layer:compileDebugKotlin`. Built with `apps/mobile/android/gradlew
  :app:assembleDebug` directly (3 min 8 s) because `expo run:android` needs a device.

**Verification**
0. `adb devices`: watch `192.168.1.68:44881` throughout; phone present at 14:20, absent from
   ~14:25 onward (also unreachable over Wi-Fi). ⚠️
1. `gradlew :app:assembleDebug :wff:assembleDebug` ✅ (12 MB + 40 KB). Both installed on the
   watch. `:app`'s face: **blocked** (logcat above). `:wff`'s face: listed under *Downloaded*
   in the watch's "Add watch face" list, added, and active —
   `dumpsys wallpaper` → `com.samsung.wear.watchface.runtime/…DeclarativeWatchFaceRuntime0`;
   both slots bound to our sources (`ComplicationInfo{slotId=11, …MinuteCounterComplicationService}`,
   `slotId=12, …NextBlockComplicationService`). Screenshots taken. ✅
   - First attempt could not be favourited: `IllegalArgumentException:
     defaultDataSourcePolicy.primaryDataSourceDefaultType EMPTY must be in the supportedTypes
     list` — the attribute is `primaryProviderType`, not `primaryProviderDefaultType`. Fixed.
   - The hand did not render as a narrow rotated `PartDraw`; a full-size `Group` with
     `pivotX/Y=0.5` + `Transform target="angle"` does.
2. Phone Gradle log shows the module tasks ✅; **app not cold-started — no phone.** ⚠️
3. **Phone → watch not exercised.** ⚠️ Watch-side chain proven instead: a fake snapshot
   (`countMode: down`, `nextBlock: FakeStandup 3:30 PM`) pushed with `run-as` into
   `shared_prefs/1440_watch.xml`, face switched away and back → DWF runtime logs
   `[11:TEXT] "542"`, `[11:TITLE] "MIN LEFT"`, `[12:TEXT] "FakeStandu 3:30 PM"` and the
   face shows exactly that (screenshot). ✅ for everything downstream of `onDataChanged`.
4. Not run (needs 3). ⚠️
5. `am force-stop com.planner1440.app` then re-activate the face → complications still show
   the values (they read SharedPreferences; the process was not even alive between
   requests). ✅
6. `npx tsc --noEmit -p apps/mobile` ✅ — after restarting Metro; the stale Metro had put
   `/..\..\modules\wearable-data-layer\` into `.expo/types/router.d.ts` (Known debt).

**Not done / caveats**
- The phone → watch hop. Everything up to `putDataItem` is code that compiled but never
  ran; everything from `onDataChanged` onward ran with injected data. The Data Layer's own
  routing (same package + certificate, paired node) is the one untested assumption.
- Per-block arcs are absent from the face; the Canvas renderer that draws them is blocked
  on this hardware (Known debt).
- No timer-driven resync; no iOS; `syncIOS` still a stub.
- `set-watchface` over `DEBUG_SURFACE` cannot *add* a face (`Watch face family doesn't
  exist`) — the picker UI is required once; after that `--es watchFaceId com.planner1440.wff`
  works. Recipe in the memory note and the watch README.
- The watch still has the fake snapshot in `com.planner1440.app`'s prefs; the first real
  snapshot overwrites it.
- `watch/android-wearos/gradle.properties` commits a machine-specific `org.gradle.java.home`
  (the handoff asked for it); edit it on another machine.

### 2026-09-23 — Pass 4: todo → calendar PICK flow, Settings back fallback (+ two more bugs) (PR #13, merged `77afc75`)
Branch `fix/todo-pick-flow`. JS-only; no native rebuild. Reused the Metro that pass 3's
`expo run:android` left on :8081 (PID 25108) — Fast Refresh for `apps/mobile` edits, one
`am force-stop` + relaunch to pick up the `packages/core` edit. Same Galaxy over `adb`.

**Shipped**
- **Carrier is a route param.** `apps/mobile/src/app/tasks.tsx` does
  `router.push({ pathname: '/day', params: { pick: todo.id } })`; the old `pendingTodoId`
  local state (lost on push because `<Slot>` unmounts the Tasks screen) is gone.
  `apps/mobile/src/app/day.tsx` reads it with `useLocalSearchParams`, resolves it against
  `useTodoStore` on every render, and ignores ids that are missing or not `pending`. Chosen
  over a non-persisted settings-store field because it is ephemeral by construction: no
  new state to keep in sync, nothing to exclude from `partialize`, and the tab bar's
  `router.push(tab.path)` drops it on any tab switch for free.
- **Ending placement uses `router.setParams({ pick: '' })`, not `router.replace('/day')`.**
  `replace` swaps the route and remounts `DayScreen`, which reset `DayGrid`'s scroll (to
  "now" on today, to midnight on any other day) right after the user placed a block there.
  `setParams` mutates the focused route in place; the grid stays put. Verified on-device.
- **Placement banner** on Day (between the summary bar and the next-block bar): "PLACING ·
  LONG-PRESS A FREE SLOT", the todo's title in its category colour, duration + category,
  and a CANCEL button. Tokens only (`C.bg2`, `C.borderHi`, `C.L2/L3`, accent `ac`).
- **`handleLongPress` in placement mode places directly at the snapped minute on
  `selectedDate`** — no modal. Outside placement mode the add modal opens as before.
- **Shared helper `apps/mobile/src/services/placeTodo.ts`** — `eventFromTodo()` builds the
  block, `placeTodo()` adds it and links the todo (`linkEventToTodo` sets `scheduled`).
  `TaskBacklog.tsx`'s `handleSchedule` and `handleAutoAll` now call it instead of carrying
  two copies of the object literal. Lives in the app, not core, because core does not
  depend on `nanoid`.
- **`TodoRow.tsx`:** `isPicking` / "PLACING →" / the ✕ toggle on PICK removed — with the
  route-param carrier the Tasks screen is never mounted while placement is active, so that
  state could never be true. `#38BDF8` → `C.cyan` (exact token). The greens stay (see Known
  debt).
- **Settings ✕ and SAVE & CLOSE**: `router.canGoBack() ? router.back() :
  router.replace('/day')` (`apps/mobile/src/app/settings.tsx`).

**Found and fixed on the way**
- **Long-press inside the wake/sleep shading placed the block at the wrong minute.**
  `DayGrid.tsx` computes the minute from `nativeEvent.locationY`, which RN measures
  relative to the *touched* view, and the two shade `<View>`s were touch targets — a press
  at 10:15 PM (inside the 10 PM sleep shade) read as minute 15. The ruler and now-line
  already had `pointerEvents="none"`; the shades now do too. This was pre-existing for the
  modal path as well (the modal's START field showed the wrong minute, which the user could
  correct by hand). With direct placement there was no modal to correct it in, so it had to
  be fixed here.
- **Deleting a todo-linked block never returned the todo to `pending`.**
  `packages/core/src/store/useCalendarStore.ts:49` used `import('./useTodoStore')` "to avoid
  a circular import". There is no cycle (`useTodoStore` imports only zustand and a type),
  and on the device the dynamic import rejected every time — Metro tried to fetch
  `http://localhost:8081/..\..\packages\core\src\store\useTodoStore.bundle?…lazy=true` and
  failed with `Failed to load split bundle`, shown as a "Possible unhandled promise
  rejection" LogBox toast. The todo stayed "on calendar" with a dangling `linkedEventId`.
  Now a static import; also clears the one long-standing `tsc` error.

**Verification on-device (screenshots taken at each step)**
1. Tasks → `+ TASK` → `PickTest`, 30m, Meeting → PICK → Day with the banner "PLACING ·
   LONG-PRESS A FREE SLOT / PickTest 30m · Meeting", cyan left border. ✅
2. Swiped to Sep 24, long-pressed 10:15 PM → block `PickTest 10:15 PM · 30m`, Meeting
   colour, ☑ from-tasks badge; banner gone; grid did not jump; stats 1 → 2 blk. Tasks shows
   it under ON CALENDAR. ✅ (First attempt landed at 12:15 AM — that is how the shade bug
   was found; the scroll swipes used to locate it then grabbed its top knob and shrank it
   to 15m, which is the existing resize gesture doing its job.)
3. PICK → banner CANCEL → no block, banner gone; Tasks still PENDING. PICK → TASKS tab →
   still PENDING. PICK again → banner again. ✅
4. Delete the block → toast → UNDO → block back, Tasks ON CALENDAR. Delete → wait 5 s →
   Tasks PENDING, no LogBox. ✅ (Before the core fix: stayed ON CALENDAR + LogBox toast.)
5. `am force-stop` + relaunch → block still on Sep 24, todo still ON CALENDAR. ✅
6. Gear → Settings → SAVE & CLOSE → Day (Sep 24, unchanged). `am force-stop` +
   `am start -a android.intent.action.VIEW -d planner1440:///settings` → SAVE & CLOSE →
   Day, no toast. Same again with ✕ → Day, no toast. ✅
7. `npx tsc --noEmit -p apps/mobile` and `-p packages/core`: both clean. ✅

**Not done / caveats**
- Hardware back after cancelling via a tab switch pops back to the `/day?pick=…` route, so
  placement mode resumes for that todo (it is still pending). Arguably correct; not changed.
- The phone still carries the pass-2/3 test blocks (`NotifTest*`, `OtherDay*`, `PastBlock`)
  plus a pending `PickTest` todo.
- `#34D399` / `#1a3d2a` in `TodoRow.tsx` left as-is (Known debt).
- Metro from pass 3 is still on :8081. Pass 5 needs a native rebuild — kill the tree first.

### 2026-09-23 — Pass 3: URL scheme rename + native rebuild, exact alarms, reminder taps (PR #12, merged `4be6239`)
Branch `fix/url-scheme-rebuild`. First native rebuild since 2026-09-22, on the same Galaxy
(Android 16, `America/Chicago`) driven over `adb`. Two Gradle builds, ~1.5 min each.

**Shipped**
- `apps/mobile/app.json`: `scheme` → `planner1440`; `android.permissions` →
  `["android.permission.USE_EXACT_ALARM"]`.
- `android/` was **not** regenerated (no prebuild). `AndroidManifest.xml` hand-edited to
  match: `<data android:scheme="planner1440"/>` and the `USE_EXACT_ALARM`
  `<uses-permission>`. The `settings.gradle` / `gradle.properties` hand edits survived;
  they are now documented in `CLAUDE.md`.
- Reminder taps (`apps/mobile/src/services/notifications.ts`, `apps/mobile/src/app/_layout.tsx`):
  each reminder carries `data: { date }`; the root layout registers
  `addNotificationResponseReceivedListener` and, once hydrated **and** the navigator is
  ready (`useRootNavigationState()?.key`), reads `getLastNotificationResponseAsync()`,
  navigates with `setSelectedDate(date)` + `router.replace('/day')`, then clears the last
  response so a reload doesn't replay it. `reminderDateFromResponse()` validates the
  `YYYY-MM-DD` shape because Android round-trips `data` through a JSON string.

**Trap: the first rebuild did not fix it.** The manifest had the new scheme but the app
still cold-started on Unmatched Route showing `1440planner:///1440planner:`. The JS reads
the scheme from `Constants.expoConfig`, an `app.config` asset that
`:expo-constants:createExpoConfig` writes — and that task was `UP-TO-DATE` (outputs
declared, no inputs). The asset on the device dated from 2026-05-08 and still carried
`"root":"src"` for expo-router. Deleting
`apps/mobile/node_modules/expo-constants/android/build/generated/assets/expo-constants/`
made the second build execute the task; the regenerated asset had `planner1440` and the
permission. Recorded in `CLAUDE.md` and Known debt.

**Verification on-device**
1. 3× `am force-stop` + launcher intent → Day screen every time. (Before the asset fix it
   was Unmatched Route 3/3 with the same APK — screenshots taken both times.)
2. Cold `planner1440:///settings` → Settings; warm `planner1440:///day` → Day.
3. `dumpsys package`: schemes `planner1440` + `com.planner1440.app`, no `1440planner`;
   `android.permission.USE_EXACT_ALARM: granted=true`.
4. Lead 0, block at 22:27 → `dumpsys alarm` shows `origWhen=22:27:00.000 window=0
   exactAllowReason=policy_permission`; logcat `Received BROADCAST` at 22:27:00.006 and
   `NotificationManager … notify(` at 22:27:00.076 → **76 ms** late (pass 2: 18 s and 61 s).
   A second block at 22:31 posted 74 ms late.
5. Lead time changed to 0, `am force-stop`, launcher relaunch → resync log says `lead 0m`
   and the app opens on Day. Data survived the reinstall (same debug keystore).
6. Reminder tap with the app backgrounded on Sep 24 → Day on Sep 23 (listener path). Then
   with the process gone (`am kill`, **not** `force-stop` — that cancels the alarm *and*
   the posted notification) → tap → cold start → Day on Sep 23, no Unmatched Route
   (last-response path).
   `apps/mobile` `tsc --noEmit` still has only the one pre-existing core error.

**Not done / caveats**
- Test blocks on the phone: `NotifTestA/B/C/D`, `OtherDay*`, `PastBlock`.
  `adb shell pm clear com.planner1440.app` wipes them (and settings + the notification
  permission, whose prompt will then show again).
- The Metro that this pass's `expo run:android` started is still on :8081 (a
  `cmd /c npx expo run:android` process tree from 22:15). Pass 4 is JS-only — reuse it. Kill
  the tree first if another rebuild is needed.
- Reminders are today-only, so the date routing on tap mainly matters when the user left
  the app on another day; that is the case that was exercised.
- Settings' SAVE & CLOSE from a deep-linked Settings screen logs a dev-only GO_BACK toast
  (Known debt, pre-existing).

### 2026-09-23 — Pass 2: local notifications (+ two pre-existing core bugs) (PR #11, merged `7a9e5d4`)
Branch `feat/local-notifications`. Verified on a physical Galaxy (Android 16,
`America/Chicago`) driven over `adb`; JS reloaded through the Metro instance the previous
`expo run:android` had left running on :8081. No native rebuild.

**Shipped**
- `leadTimeMinutes` (default 15) in `useSettingsStore` — interface, defaults **and**
  `partialize`.
- `scheduleDailyReminder(events, date, leadMinutes)` subtracts the lead, filters to `date`,
  posts on the `1440-planner` channel, skips fire times already in the past, returns the
  count and logs it in dev (`[notifications] N reminder(s) for <date>, lead Nm`).
- `_layout.tsx`: `requestPermissions()` once after hydration; debounced (500 ms) resync on
  today-only calendar changes (shallow identity compare of the today subset), lead-time
  changes, `AppState` → active (re-checks permission), and local-midnight rollover.
- Settings → NOTIFICATION LEAD TIME chips `At start / 5m / 10m / 15m / 30m`.

**Found and fixed on the way — both pre-existing, both in `packages/core`**
- `today()` returned the **UTC** date (`toISOString()`), so after 7 PM Central the whole
  app — Day screen, now-line, and the new reminders — was on *tomorrow*. Now built from
  local date parts. Blocks created in the evening before this fix are stored under the
  next day's date.
- **Persistence never worked.** zustand's `createJSONStorage(getStorage)` calls
  `getStorage()` once, at store creation. All three stores handed it a closure over a
  module variable that `initAllStores()` reassigned *later*, so every store ran on the
  no-op placeholder forever. The device had no AsyncStorage database at all. Fixed with
  `persist.setOptions({ storage })` + `rehydrate()` inside each `initXStorage()`, plus
  `skipHydration: true`. `databases/RKStorage` now exists on the device and settings
  survive a force-quit.

**Verification run on-device — all six steps from the brief**
1. Revoked `POST_NOTIFICATIONS` (`pm revoke --user 0`), cold-launched → system prompt →
   Allow → scheduling resumed. ✅
2. Lead 0, block at 20:14 → `AlarmManager` alarm at 20:14:00, notification posted 20:14:17
   on channel `1440-planner`. ✅
3. Lead 15, block at 20:56 → alarm at 20:41:00, posted 20:42:01 (OS batching — see Known
   debt). ✅
4. Lead 10 → force-quit → relaunch → `lead 10m` in the resync log. ✅ (failed before the
   persistence fix; that is how the bug was found)
5. Swiped to Sep 24, created a block there → calendar mutation logged, **no** reminder
   resync. ✅
6. Block at 10:00 AM (past) → count unchanged, no crash. ✅

**Not done / caveats**
- The device still carries the test blocks (`NotifTestA/B`, `OtherDay*`, `PastBlock`) —
  delete them or clear app data.
- Cold start currently lands on "Unmatched Route" (pre-existing scheme bug, see Known
  debt); every launch during verification needed a DAY-tab tap first.
- Reminder tap is not handled. Midnight rollover and permission-revoked-in-system-settings
  paths are implemented but were not exercised on-device.
- `apps/mobile` `tsc --noEmit` has one pre-existing error (`useCalendarStore.ts` dynamic
  import vs the mobile tsconfig's `module` setting); `packages/core` typechecks clean.
- `adb shell input tap` does not register on the date-strip `FlatList` items; use a
  horizontal swipe on the grid to change days when driving the app over adb.

### 2026-09-22 — Pass 1: foundation + preview unblock
Branch `chore/foundation-and-preview-unblock`. Docs/tooling only, no app source changes.

- Deleted a stray untracked root `app.json` that shadowed `apps/mobile/app.json` and existed
  only to prop up an incorrect README command.
- Rewrote README Quick Start with correct commands, real prerequisites, the JDK-17/Gradle
  note, and an explicit Expo-Go-doesn't-work warning.
- Removed a Windows junk file (`apps/mobile/%ProgramData%/…/_active.uusver`) that had been
  **committed** in `5516899` via a failed `%ProgramData%` env-var expansion.
- Added `CLAUDE.md` (git workflow, session workflow, load-bearing-code warnings).
- Added this file; filled `docs/DESIGN_TOKENS.md`.
- Corrected stale checkboxes in `WATCH_FACE_ROADMAP.md` and `CLAUDE_CODE_HANDOFF.md` —
  ticks grep-verified against the tree, not assumed.

**On-device verification:** not run in this session (`adb devices` was empty). The owner
confirmed afterwards that `npx expo run:android` builds and launches on a physical Galaxy
(2026-09-22); pass 2 reused that installed build and reloaded JS over Metro.

---

## 🤝 Handoff prompt (pass 13)

> Standing rule (`CLAUDE.md` → Session workflow): every session ends by replacing this
> section with the *next* session's prompt, in this format. Paste the block below as the
> opening message of the next session.

# 1440 Planner — Pass 13: 12/24-hour clock setting (phone + watch face)

Read `CLAUDE.md` and `docs/STATUS.md` first. Both are current as of 2026-10-08 (late
evening).

**State you inherit.** The watch face is feature-complete for the owner's two-ring form:
`feat/watch-category-ring` (pushed; `ce6c749` phone, `407d716` watch, one docs commit, on
top of `feat/watch-arcs` `ace70a2`) draws ring + ticks in the count-mode colour, a thin
category-range ring and the block arcs into the slot-4 bitmap, and the watch runs that
build (installed 2026-10-08 19:35). The stale-date gate is in. **Branch for this pass:**
`git checkout feat/watch-category-ring; git pull; git checkout -b feat/clock-format`
(keep stacking; `git log origin/main --oneline | head` first — if the owner has merged
#20–#24 and the two watch branches meanwhile, rebasing is their call, not yours). This
pass is **phone JS + watch**, like pass 12: the phone side needs no native rebuild (the
2026-09-24 install + the running Metro serve it); the watch needs a rebuild of both APKs.

**PR state.** Two branches have no PR yet — the owner opens
`https://github.com/cryptomdma/1440-planner/pull/new/feat/watch-arcs` (body in the
pass-12a evening log) and `…/pull/new/feat/watch-category-ring` (body in the pass-12
log). Sessions cannot read the GitHub token (the permission classifier refuses
`git credential fill`); do not retry it. For this pass, push and print the body for
`pull/new/feat/clock-format` in the chat and in the log.

## Prerequisites

1. **Watch first.** `adb connect 192.168.1.109:5555`, then on `-s 192.168.1.109:5555`:
   `input keyevent KEYCODE_WAKEUP`, `settings put system screen_off_timeout 1800000`,
   `dumpsys trust | grep deviceLocked` — one PowerShell call. If `.109:5555` times out,
   read `adb devices` *before* asking the owner: after a reboot the watch lists itself as
   an `offline` mDNS entry on a wireless-debug port (`192.168.1.1xx:3xxxx`) —
   `adb disconnect <that>; adb connect <that>` (twice if needed) gives `device` with no
   pairing code, then `adb -s <that> tcpip 5555` re-pins it. Nothing listed at all = asleep
   with Wi-Fi parked; only the owner's tap helps. Put `60000` back at the end. It held a
   full session at 44 % off the charger.
2. Phone `192.168.1.107:5555` (ignore the stray `:44047` entry — always `-s …:5555`).
   Metro node PID 33668 on :8081 bundles from disk; `am force-stop` + launch picks up JS
   edits. **Check `adb reverse --list` before the first cold start** — pass 12 found it
   empty with no reinstall in between, and the app showed the red "Unable to load
   script" screen until `adb reverse tcp:8081 tcp:8081` was re-issued.
3. Disk: 26.2 GB free at the end of pass 12; `(Get-PSDrive C).Free` anyway.
4. Start an unfiltered watch logcat to a file at once (`Start-Process adb -ArgumentList
   '-s',$w,'logcat','-v','time' -RedirectStandardOutput <file> -WindowStyle Hidden`);
   grep `1440:|DWF:WearComplicationProvider`.

## Goal

**Decide first, then build:** one `clockFormat: '12h' | '24h'` setting on the phone that
drives both displays. The phone half is mechanical; the watch half has two viable designs
and the choice is the first thing to settle (write the decision into "Decisions on
record" before coding):

- **(A) Slot-gating — recommended.** Exactly the count-mode pattern that already works:
  two `SHORT_TEXT` slots in the clock's box (`x=125 y=228 w=200 h=30` in the generator),
  each with its own `<Template>` over the *watch* clock — `%02d:%02d` over
  `[HOUR_0_23]`/`[MINUTE]` for 24 h, `%d:%02d` + AM/PM for 12 h — and two gate services
  (`Clock12ComplicationService` / `Clock24ComplicationService`) that return data only
  when the snapshot's `clockFormat` matches, else `NoDataComplicationData()`. One setting,
  on the phone, no second UI. Cost: two more services in the manifest and in
  `DataLayerClient.COMPLICATION_SERVICES`, and the clock becomes a slot (set
  `isCustomizable="FALSE"` so the owner cannot rebind it the way slot 2 got rebound).
  Caveat to verify on-device: a `<Template>` inside a `<Complication>` can still read
  `[HOUR_*]`/`[MINUTE]` — the count-mode slots already do exactly that, so expect yes.
- **(B) WFF `UserConfiguration`** (a `<ListConfiguration>` with two options and a
  `<ListOption>`-gated clock element): set from the watch's own face-settings UI, no
  phone involvement — but it is a second place to set it and the phone never knows. Only
  pick this if (A)'s template-inside-slot check fails.

Then:

1. **Core:** add `clockFormat: '12h' | '24h'` (default `'12h'`, today's behaviour) to
   `SettingsState` in `packages/core/src/store/useSettingsStore.ts:21` (+ the `partialize`
   list around line 68). Make `minuteToTimeStr` in `packages/core/src/utils/time.ts:1`
   format-aware without touching its 30 call sites in 14 files: keep its signature,
   read the format from `useSettingsStore.getState()` inside it (stores import nothing
   from `utils/time`, so no cycle — check with grep first), or add a
   `minuteToTimeStr(m, format?)` overload and a `useTimeStr()` hook; prefer whichever
   keeps `tsc` clean with the fewest touched files. `clockToMinute` (`time.ts:13`) parses
   AM/PM input; in 24 h mode `MinuteInput` must accept `17:00` — check
   `apps/mobile/src/components/ui/MinuteInput.tsx` before deciding how deep this goes.
2. **Settings UI:** a CLOCK FORMAT row with `12-HOUR` / `24-HOUR` chips next to COUNT
   MODE in `apps/mobile/src/app/settings.tsx` (same chip component as count mode).
3. **Snapshot:** `clockFormat` in `WatchSnapshot` (`apps/mobile/src/services/watchSync.ts`,
   append after `ranges`; `version` stays 1) and a re-send on change — extend the
   `useSettingsStore.subscribe` comparison in `apps/mobile/src/app/_layout.tsx:127`
   (it lists the fields that trigger a send; add `clockFormat`).
4. **Watch (A):** two gate services modelled on `CountModeComplicationService`
   (`ComplicationHelper.kt:62`, gate at line 78), manifest entries copied from the
   CountUp block (`AndroidManifest.xml:78`), both added to
   `DataLayerClient.COMPLICATION_SERVICES`; generator: replace the clock `<PartText>`
   (`make-watchface.ps1`, the "Wall clock" block) with two slots in the same box, the
   12-hour one using `[HOUR_1_12]`, `[MINUTE]` and `[AMPM_STATE]` (0 = AM, 1 = PM — both
   verified to resolve in pass 8.5; a `<Template>` with a conditional is not available,
   so render AM/PM as two more gated `<PartText>`s or a `%s` over a `[AMPM_STATE]`-driven
   expression if one works — probe it on-device first, the round trip is ~90 s).
   `NextBlockComplicationService` already sends `timeStr` from the phone (slot 2's
   "till 9:45 PM"), so it follows the phone format for free once `minuteToTimeStr` does.
5. Regenerate, rebuild, reinstall both APKs, reload the face, screenshot in both formats.

## Findings — do not re-derive

- Count-mode gate pattern: `ComplicationHelper.kt:36–91` (`countsDown()` reads the
  snapshot; `CountModeComplicationService` returns `NoDataComplicationData()` when the
  mode does not match — **never `null`**, null means "no change" and both figures stay
  on screen). Slots 1 and 3 share `x=150 y=158 w=150 h=68` in the generator's `$modes`
  loop; the runtime logs them as `[12]`/`[13]`, slot 2 as `[14]`, slot 4 as `[11]`.
- `DataLayerClient.kt:74–77` requests an update from every service in
  `COMPLICATION_SERVICES` after each snapshot — new gates must be in that list or they
  only refresh on a face reload.
- Generator: `watch/android-wearos/tools/make-watchface.ps1`; run with
  `powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-watchface.ps1`; validate
  with `[xml](Get-Content … -Raw)`. `<DigitalClock>` does not render on this runtime —
  build clock strings from `<PartText>` + `<Template>` only. The Scene order is slot 4,
  sweep, hand, dial, slots 1/3, clock, slot 2; z-order is declaration order.
- Build: `watch\android-wearos\gradlew.bat :app:assembleDebug :wff:assembleDebug` (~10 s
  warm); install both `app-debug.apk` and `wff-debug.apk` with `adb -s <watch> install
  -r`; reload the face with the two `DEBUG_SURFACE` broadcasts (UltraInfoBoard then
  `--es watchFaceId com.planner1440.wff`); screenshot with `screencap -p`.
- Phone Settings over adb (1440×3120): `planner1440:///settings` only navigates when the
  app is *not* already running — force-stop first, or tap the gear at (1370, 602) on Day;
  COUNT UP (386, 574), COUNT DOWN (1055, 574), ✕ (1327, 244). Always `uiautomator dump`
  and find the new chips by text before tapping.
- Snapshot on the wrist: `run-as com.planner1440.app cat shared_prefs/1440_watch.xml`.
  The owner's data: categories Deep Work, Meeting, Admin, Break, Personal (AM) 240–360,
  Personal (PM) 1080–1260, Work 405–1020; `Daily Huddle` daily at 450/15. Never delete
  it; test with your own rows and remove them.
- Slot 2 on the owner's favourite is user-bound to `CountDownComplicationService` (shows
  a second figure in count-down mode only). Not a code bug; leave it unless the owner
  asks — and make the new clock slot(s) `isCustomizable="FALSE"` so it cannot happen there.
- `tsc --noEmit -p apps/mobile` and `-p packages/core` must stay clean (run from the
  repo root — paths are relative to it).

## Constraints

- `applicationId com.planner1440.app`, `app/debug.keystore`; edit the generator, commit
  the generated XML; `NoDataComplicationData()` never `null`; no dynamic `import()` in
  core; never delete the owner's phone data; dark mode only; tokens from `DESIGN_TOKENS`.
- Do not accept any dialog on the owner's phone or watch on their behalf.
- Decide (A) vs (B) and record it before writing watch code.

## Verification (required)

1. Watch listed, timeout raised, `deviceLocked=0`; `adb reverse --list` non-empty.
2. Phone: 12-HOUR / 24-HOUR chips persist across a cold start; Day ruler, block modal,
   schedule rows, task rows and the watch preview all flip format (spot-check two).
3. Watch: after 24-HOUR, `Received snapshot` and the face clock reads `19:05`; after
   12-HOUR, `7:05 PM` (or the two-element equivalent); DWF log shows one clock slot with
   data and the other `NO_DATA`; slot 2's "till …" string follows the format.
4. Hand, sweep, ring, ticks, ranges, arcs, figure unchanged (screenshot both modes).
5. Gradle clean; both `tsc` clean.

## Wrap-up

- Commits: `feat(settings): 12/24-hour clock format`, `feat(watch): clock format follows
  the phone setting`, `docs: pass-13 …`. Push. Print the PR body (stacked on
  `feat/watch-category-ring`).
- `docs/STATUS.md`: TL;DR, ✅ Working (Settings bullet, watch sync bullet gains
  `clockFormat`, watch row), Decisions on record (A vs B and why), Known debt
  (display-strings paragraph: the clock now follows the phone via gating), Next up
  (strike 13; the list is then empty bar the "not staged" items — propose the next
  pass from Known debt: the 00:00 watch alarm for the stale-date check, or the
  backgrounded resync), log entry, replace this section with the **pass-14 handoff**.
- Print the next handoff in full in the chat, last. `screen_off_timeout` back to `60000`.
  Update `device-and-tooling` with the watch address/pin state.
