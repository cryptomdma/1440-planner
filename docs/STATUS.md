# Project Status

**Last updated: 2026-09-25** — read this first; it is the source of truth for project state.
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
and now have a concrete plan. Eighteen PRs have merged, pass 6 among them (#18, `a87dc52`);
**three branches are open and stacked**: `fix/watch-arc-rotation` (PR #19),
`chore/sdk-upgrade` (PR #20, pass 7, on #19) and `feat/repeat-rules` (PR #21, passes 8 and
8.5, on #20). Merge in that order. The owner's feature backlog is staged as passes 7–12
under **Next up**.

---

## ✅ Working

**`packages/core` (`@1440/core`)** — platform-agnostic
- Types: `CalendarEvent`, `Todo`, `RepeatConfig` (+ `exceptions`/`overrides`, `SeriesScope`),
  `CATEGORIES`, `PRIORITIES`, `DESIGN_TOKENS`
- Utils: `computeLayout`, `findNextFreeSlot`, `autoScheduleQueue`, time/date helpers, and
  since pass 8 the repeat expansion in `utils/repeat.ts` — `eventsOnDate`, `datesWithEvents`,
  `expandSeries`, `occurrenceId`/`parseOccurrenceId`, `describeRepeat`,
  `migrateMaterialisedSeries`
- Three zustand stores persisted via an injectable `StateStorage` adapter
  (keys `1440-planner-{calendar,todos,settings}-v1`; the calendar store is at **`version: 2`**
  with a `migrate()` that folds pre-pass-8 materialised repeat rows back into base + rule)

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
- **Tasks** — backlog with add form, AUTO ("schedule now"), AUTO-SCHEDULE ALL, and
  **PICK** (pass 4): Tasks → PICK pushes `/day?pick=<todoId>`; Day shows a placement
  banner naming the todo; long-press on a free slot creates the linked block there
  (`fromTodo`, `linkedTodoId`, todo → `scheduled`); CANCEL on the banner or any tab
  switch abandons it. All three paths share `apps/mobile/src/services/placeTodo.ts`.
  Deleting a placed block returns the todo to `pending`; UNDO re-links it.
- **Watch** — SVG watch-face *preview*, phone-side only
- **Watch sync (Android, passes 5–6)** — `apps/mobile/modules/wearable-data-layer/` (Expo
  local module, Kotlin) puts the `WatchSnapshot` JSON at Data Layer path `/1440/snapshot`.
  `apps/mobile/src/app/_layout.tsx` sends it after hydration, on every calendar change,
  when count mode / wake / sleep change, once a minute while foregrounded, and on
  foreground (store-driven sends are debounced 500 ms, so a drag is one write). The
  snapshot is always **today's**, whichever day the phone is browsing. Verified on the
  Galaxy Watch 7: phone `putDataItem` → watch `DataLayerClient.onDataChanged` in 3.5–4 s,
  complications refreshed via `requestUpdateAll()`.
- **Settings** — count mode, default duration, auto-schedule buffer, notification lead time,
  wake/sleep minutes (reachable only via the gear on the Day screen, not the tab bar)
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
| **Wear OS watch face** | **Builds, installs, renders and receives live data (passes 5–6, reworked in 8.5).** `watch/android-wearos` = `:app` (`com.planner1440.app`: Data Layer listener + four complication data sources + the androidx Canvas face, which **Wear OS 6 blocks outright**) and `:wff` (`com.planner1440.wff`: the no-code Watch Face Format face that actually shows). Draws ring, 96 ticks, 24 h sweep, minute hand, the minute figure and the wall clock **from the watch's own clock**; the phone supplies only the count mode and the current/next block. **Still no per-block arcs** (Known debt, Next up #12a). |
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

**The WFF face still cannot draw per-block arcs.** Watch Face Format has no loop and no way
to instantiate N shapes from data, so the face shows the 24-hour sweep, the minute hand, the
minute figure, the clock and the current/next block — but nothing per block. The data is
already on the wrist (the snapshot carries every block's start, duration and resolved hex
colour), so this is purely a rendering gap. The Canvas renderer that *can* draw them is
blocked by Wear OS 6 on this hardware. **Plan, from the pass-8.5 findings:** render the arcs
to a bitmap on the *watch* — `DataLayerClient` already holds the JSON and already runs
complication sources, so it is a `Canvas.drawArc` loop in one more source — and show it
through a full-face image complication slot. Gated on a spike: whether a `SMALL_IMAGE` /
`PHOTO_IMAGE` slot covering all 450×450 renders untinted. See Next up #12a.

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
from phone data**: that is why the ring, ticks and hand stay amber in both count modes while
the centre figure changes colour. Completing that needs the same full-face slot the arcs
plan introduces — see Next up #12a.

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

**Numeric inputs coerce on every keystroke.** `TaskBacklog.tsx:129` is
`setNewDur(Math.max(5, parseInt(t) || 30))`, so backspacing to empty snaps the field to 30
and typing "3" on the way to "30" snaps it to 5 — the duration is effectively uneditable.
`RepeatPicker.tsx:48` and `:58` do the same to interval and count. The fix is one shared
numeric input that holds the raw string and coerces on blur; pass 9.

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
in existence is disposable test data. The first constraint is weaker since pass 8.5: it
assumed hand-authored WFF elements, and the arcs plan in 12a draws on a Canvas instead,
where adding the category ring later is a few more calls rather than a rebuild.

7. ~~**SDK upgrade off 51.**~~ **Done in pass 7** (PR #20) — SDK 51 → **57**, not the 55 the
   old handoff guessed at, because 57 is the current SDK. Dependency rot, the
   `createExpoConfig` trap and all three metro resolver workarounds are gone.
8. ~~**Repeat, finished.**~~ **Done in pass 8** (PR #21) — rule-based virtual expansion,
   "forever", cancel with scope, single-occurrence edit/delete, store migration to v2, and
   the month-grid date picker in the block modal. Cleared the repeat half of "Unimplemented
   settings".
9. **Tasks.** A shared numeric input that holds the raw string and coerces on blur —
   `TaskBacklog.tsx:129` (`Math.max(5, parseInt(t) || 30)`) makes the duration field
   impossible to clear or to type "30" into, and `RepeatPicker.tsx:48,58` has the same
   bug. Then open/edit a task on row press (`TodoRow` has buttons but no row handler) and
   repeat on tasks (`Todo` has no repeat field at all).
10. **Schedule view.** An agenda list of blocks across days. Self-contained; no core
    changes.
11. **Categories.** Add/delete/edit, plus per-category time ranges (`Personal 06:00–12:00`,
    `Work 12:00–18:00`, …) generalising today's single wake/sleep window. **The heavy
    one:** `CategoryId` is a TS union and `CATEGORIES` a frozen const in
    `types/event.ts:3-18`, so this means a new persisted store, `id: string`, every
    `CATEGORIES.find()` rewritten, and a policy for blocks whose category was deleted.
    The watch is safe — `buildWatchSnapshot` already resolves colours to hex at send time.
12. **Watch face rings** — the per-block arcs Known debt, in the owner's two-ring form:
    a thin outer ring for category time ranges, thicker inner rings for actual blocks.
    The *category* ring needs 11; the block arcs do not — see 12a.
12a. **Watch block arcs** (new after pass 8.5; can be done any time, does not need 11).
    Render today's blocks as coloured arcs on the real face. WFF cannot draw them, so:
    a new complication data source on the *watch* draws the arcs onto a `Bitmap` with
    `Canvas.drawArc` from the snapshot already in `SharedPreferences`, and the face shows
    it through an image complication slot covering the full 450×450 behind the hand. No
    phone changes at all — the snapshot already carries every block's start, duration and
    hex colour. **Spike first:** confirm a `SMALL_IMAGE` / `PHOTO_IMAGE` slot at full face
    size renders untinted on the Galaxy Watch 7; that is the one unknown. Pass 8.5 already
    proved the neighbouring mechanics (a full-size slot with `isCustomizable="FALSE"`
    binds, and EMPTY slots simply do not render). **This also unblocks the rest of the
    colour work:** a full-face slot is the only scope from which phone data can style the
    ring, ticks and hand, so count-mode colour for the whole face comes with it — and it
    makes 12's category ring a few more draw calls in the same renderer rather than a
    second build-out, which weakens the "11 must precede 12" ordering below.

Not staged, deliberately:
- **A 12/24-hour dial toggle.** On a 12-hour dial every block appears twice (the owner's
  own "possibly double stacked" note), and `WATCH_FACE_ROADMAP.md` closes by calling the
  1440-minute sweep the product's unfair advantage. Worth settling as a product question
  first — a 12-hour *hand* for clock legibility is a different, smaller feature than a
  12-hour *dial*.
- **Watch resync while the phone app is backgrounded** (Known debt) — native-side timer
  or watch-side current/next computation.
- **`syncIOS` via WatchConnectivity** — blocked on an iOS build path (no Mac, no EAS).

---

## Session log

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
2. Clock renders — `9:43 PM`, correct meridiem. It had been absent since pass 5. ✅
3. Figure live on the watch, count-down: **`137` in cyan** with `MIN LEFT`. ✅
4. Gating correct: `[11:NO_DATA] NoDataSource` for the count-up slot while
   `[12:SHORT_TEXT] …CountDownComplicationService` carries data. Exactly one figure on
   screen. ✅
5. Slot 2: `[13:TEXT] "NOW Test text is t"` / `[13:TITLE] "till 9:45 PM"` while that block
   was running — the case that used to read "No blocks". ✅
6. `gradlew :app:assembleDebug :wff:assembleDebug` clean throughout. ✅

**Not verified — the watch went to sleep before these two.** Its Wi-Fi radio parks when the
screen is off and eight reconnect attempts over ~5 minutes all timed out, so:
- **the flip to count-up was never seen on the wrist.** The gate mechanism is proven in the
  count-down direction (step 4 above shows the up slot correctly empty), and the up path is
  the same code with the boolean inverted, but it has not been observed. **Check this
  first next session:** phone Day screen → ▲ → the figure should become amber with
  `MIN ELAPSED`, and logcat should show `[11]` gaining data and `[12]` going `NO_DATA`.
- **the figure ticking with the phone app closed** was not timed. Force-stop the phone app,
  leave the watch a few minutes and confirm the number still advances.

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

## 🤝 Handoff prompt (pass 9)

> Standing rule (`CLAUDE.md` → Session workflow): every session ends by replacing this
> section with the *next* session's prompt, in this format. Paste the block below as the
> opening message of the next session.

# 1440 Planner — Pass 9: Tasks (numeric input, edit-on-press, repeat on tasks)

Read `CLAUDE.md` and `docs/STATUS.md` first. Both are current as of 2026-09-25.

**Branching — three PRs are open and stacked.** #19 `fix/watch-arc-rotation` ← #20
`chore/sdk-upgrade` (pass 7) ← #21 `feat/repeat-rules` (pass 8). Check
`git log main --oneline | head`:
- All three merged → `git checkout main; git pull; git checkout -b feat/tasks-edit`.
- #21 not merged → branch from `feat/repeat-rules` and **say so in the PR**, as passes 7
  and 8 did.
Do not merge anything yourself (`CLAUDE.md` → Git workflow); the repo owner merges.

The memory note `device-and-tooling` holds the phone serial, adb path, the `:5555`
recipe, the store-reading recipe (`exec-out run-as … cat databases/RKStorage` via `cmd`),
the unfiltered-logcat recipe, tap coordinates and how to open a PR without `gh`. It is
loaded into your context; use it.

**First, two leftovers from pass 8.5 — about five minutes.** That sub-pass reworked the
watch face and the watch fell asleep before two checks could be made. Both are watch-side
and need no code unless they fail:
1. **Count-mode flip.** On the phone's Day screen tap ▲ (count up). Within a few seconds
   the watch figure should turn **amber** and read `MIN ELAPSED`; logcat should show `[11]`
   gaining data and `[12]` going `NO_DATA`. Tap ▼ and it should return to cyan `MIN LEFT`.
   Only the count-*down* direction was observed live. If the flip does not happen, the
   suspect is `CountUpComplicationService` / `CountDownComplicationService` in
   `watch/android-wearos/app/src/main/java/com/planner1440/watchface/ComplicationHelper.kt`
   and whether `requestUpdateAll()` re-queries a source that previously returned null.
2. **The figure ticks unaided.** `am force-stop com.planner1440.app` on the *phone*, then
   check the watch figure a few minutes later. It must still be advancing — that is the
   whole point of computing it on the watch. Note the result in the PR either way.

**If the owner would rather do the watch than Tasks**, Next up **#12a** (block arcs on the
real face) is now specified in detail and is the natural follow-on from 8.5. Swap this
prompt's Goal and Findings for that item; everything else here still applies.

## Prerequisites — check before writing anything

1. **Disk.** **~1.1 GB free on C:** after pass 8.5's watch builds, and falling. Pass 9 is
   JS-only so Metro is all you need, but check `(Get-PSDrive C).Free` early and **ask the
   owner to clear space before any native build** — a phone rebuild needs several GB and
   fails at `mergeDebugNativeLibs` with a message that never mentions disk.
2. **Metro.** Pass 8 left the pass-7 `expo start` (node PID **61684**) on :8081 —
   `Get-NetTCPConnection -LocalPort 8081 -State Listen`. Reuse it: it bundles from disk,
   so `am force-stop` + relaunch picks up edits (and Fast Refresh pushes edits into the
   running app immediately — **do any "old build" data setup before editing code**).
3. **Phone** `R5CY72XEJKD`: it rebooted between passes 7 and 8 and came back on
   **`192.168.1.97`** (was `.91`) with the `:5555` pin lost. Try `adb connect
   192.168.1.97:5555`, then `.91`; if `adb devices` shows it on some other port, re-pin
   with `adb -s <ip>:<port> tcpip 5555` over that link. Re-issue `adb -s <phone> reverse
   tcp:8081 tcp:8081`. Check `dumpsys window | findstr mCurrentFocus` before every tap
   sequence — the owner uses the phone mid-session, and a stale LogBox toast can cover the
   `+ BLOCK` FAB (its ✕ ≈ (1320, 2880)).
4. **Watch** `adb connect 192.168.1.68:5555` — needed only for the two pass-8.5 checks
   above, then you can drop it. **Its Wi-Fi parks whenever the screen goes off**, and once
   that happens adb cannot get back in: eight reconnects over five minutes all timed out at
   the end of 8.5. So the moment it connects, run `input keyevent KEYCODE_WAKEUP` and
   `settings put system screen_off_timeout 1800000`, do the checks, and put `60000` back.
   If it is unreachable from the start, it needs a physical tap.
5. SDK 57, New Architecture on, `npx expo-doctor` 21/21 — keep it that way.

## Goal

Three Tasks-screen items from STATUS "Next up" #9, in this order:
1. **A shared numeric input** that holds the raw string and coerces on blur, replacing
   every coerce-on-keystroke `TextInput`.
2. **Open/edit a task on row press** — `TodoRow` has buttons but no row handler and there
   is no edit UI for a todo at all.
3. **Repeat on tasks** — `Todo` has no repeat field; pass 8 built a rule model to reuse.

## Findings — do not re-derive

**Numeric inputs (item 1) — four sites, not three.**
- `apps/mobile/src/components/tasks/TaskBacklog.tsx:130` —
  `onChangeText={t => setNewDur(Math.max(5, parseInt(t) || 30))}`. Backspacing to empty
  snaps to 30; typing "3" on the way to "30" snaps to 5. The field is effectively
  uneditable.
- `apps/mobile/src/components/ui/RepeatPicker.tsx:66` (interval, `|| 7`) and `:96` (count,
  `|| 4`) — same shape. Pass 8 rewrote the file around them and deliberately left both.
- `apps/mobile/src/components/ui/MinuteInput.tsx:49` —
  `onChange(Math.max(0, Math.min(1440, parseInt(t) || 0)))`. Same family (empty → 0 →
  the field shows "0"). It also renders the `↕ clock · 7:51 PM` helper line below, so
  keep that when you swap its input.
  Build one `NumericField` (`apps/mobile/src/components/ui/`) that keeps `useState<string>`
  for the text, calls `onChange(number)` only on blur / submit, and takes `min`, `max`,
  `fallback`. Re-sync the string when the numeric `value` prop changes from outside (the
  quick-duration buttons in `BlockModal` set duration without touching the input).

**Edit on row press (item 2).**
- `apps/mobile/src/components/tasks/TodoRow.tsx:24-29` — the row is a plain `View`; the
  only pressables are the checkbox (`:31-36`) and AUTO / PICK / ✕ (`:60-68`). No `onPress`
  prop exists.
- `apps/mobile/src/components/tasks/TaskBacklog.tsx:102-165` — the add form (title, notes,
  duration, priority, category) is inline in the `SectionList` header; there is no edit
  form. `useTodoStore.updateTodo(id, patch)` already exists
  (`packages/core/src/store/useTodoStore.ts:38`) and is wired into `TaskBacklog` (`:24`)
  but never called.
- Simplest shape: lift the add form's fields into a `TodoSheet` used for both add and
  edit (the way `BlockModal` has `AddForm`/`EditForm`), open it from a row `Pressable`
  wrapping the content column (not the whole row — the checkbox and the action buttons
  must keep their own targets). A `scheduled` todo's duration edit should **not** resize
  its placed block silently; either leave the block alone or say so in the sheet.

**Repeat on tasks (item 3) — needs a small model decision, then reuse pass 8.**
- `packages/core/src/types/todo.ts:6-15` — `Todo { id, title, priority, categoryId,
  durationMinutes, status, notes?, linkedEventId? }`. No date, no repeat.
- Pass 8's rule machinery is date-keyed: `packages/core/src/utils/repeat.ts` —
  `occurrencesOn(base, date)`, `expandSeries(base, from, to)`, `isSeries`,
  `repeatInterval`, `describeRepeat`; `RepeatConfig` in `packages/core/src/types/repeat.ts`
  with `exceptions` / `overrides`. It is typed on `CalendarEvent`, so reuse means either a
  small generic (`{ date: string; repeat?: RepeatConfig }`) or a todo → pseudo-event
  adapter. Prefer the generic; do not copy the expansion.
- A repeating todo needs an anchor date. Proposed minimum: `Todo.dueDate?: string` and
  `Todo.repeat?: RepeatConfig`; the backlog shows a pending todo once per rule date that
  is ≤ today (and not done for that date), with per-date completion recorded as
  `repeat.exceptions` (done dates) — the same "stored once, expanded on read" rule as
  blocks. **Write the decision into STATUS → Decisions on record before coding**, the
  way pass 6-follow-up did for blocks.
- `apps/mobile/src/services/placeTodo.ts` creates a **plain** block with `linkedTodoId`;
  a todo has never been linked to a repeat occurrence id (`<seriesId>:<date>`). Keep it
  that way: placing an occurrence of a repeating todo should make a plain block for that
  date. `deleteEvent` unlinks on plain ids only (`useCalendarStore.ts`, the
  `linkedTodoId` branch) — exceptions do not unlink anything.
- `RepeatPicker` needs a `startDate` prop (pass 8) — pass the todo's `dueDate`.

**Traps that are still live** (`CLAUDE.md`):
- **Never filter `useCalendarStore.events` by date yourself** — `eventsOnDate()` /
  `datesWithEvents()`. Occurrence ids `<seriesId>:<date>` pass through
  `updateEvent`/`deleteEvent` unchanged.
- **No dynamic `import()` in `packages/core`.**
- **Typed-routes trap** — creating files outside `src/app` while Metro runs *can* break
  `tsc` on `.expo/types/router.d.ts` (it did not in pass 8, it did in passes 4–6). Restart
  Metro, re-run `tsc`.
- `DESIGN_TOKENS` stays in `packages/core/src/types/event.ts`; `#34D399` / `#1a3d2a` in
  `TodoRow.tsx:21,26,114-117` are Known debt — leave them unless you add a `success` token
  on purpose.
- Touch targets inside `DayGrid`'s long-press `Pressable` stay `pointerEvents="none"`.
- **Fast Refresh applies edits to the running app.** If you need behaviour from the
  pre-change code on the device (data setup, a before/after), do it before the first edit.

## Constraints

- Pass 9 is the three Tasks items. **No categories, no schedule view, no watch rings.**
- JS-only. Do not touch `watch/android-wearos`.
- Time is minutes from midnight; convert only at the display edge.
- Any new persisted field on `Todo` must survive rehydration without a migration (all
  new fields optional) — say so in the PR if you rely on that.

## Verification (required)

1. `adb devices` lists the phone (watch optional).
2. **Numeric input**: on Tasks → `+ TASK`, clear DURATION completely (no snap), type
   `3` then `0` → shows `30`, blur on empty → falls back to `30`; ADD TASK → row shows
   `30m`. Same on `BlockModal` START/DURATION (`MinuteInput`) and on `RepeatPicker`'s
   OCCURRENCES and EVERY (DAYS). The `↕ clock · …` helper line still updates.
3. **Edit on press**: tap a pending row's title → sheet opens with its values; change
   title + duration → row updates; `am force-stop` + relaunch → persisted. Checkbox,
   AUTO, PICK and ✕ still work without opening the sheet.
4. **Repeat on tasks**: a daily repeating todo shows once today; mark it done → it is done
   for today only and reappears tomorrow (fake it by checking the store JSON: done dates
   in `exceptions`, base row untouched). PICK on it places a plain block linked to that
   todo; deleting the block returns it to pending.
5. **Nothing regressed**: cold start → Day 3×; Tasks → PICK flow (pass 4 recipe); the
   pass-8 `MigSeries` still shows on Sep 26 (30m) and not on Sep 27/28; the notification
   log line does not repeat in a 2-minute quiet window.
6. `npx tsc --noEmit -p apps/mobile` and `-p packages/core` clean; `npx expo-doctor` 21/21.

## Wrap-up

- Conventional Commits: `feat(tasks): shared numeric input that coerces on blur`,
  `feat(tasks): edit a task from its row`, `feat(tasks): repeat rules on todos`,
  `docs: pass-9 …`.
- Push, open the PR through the GitHub API (no `gh`; recipe in the memory note), **do not
  merge**. Say which branch you stacked on. PR description: the numeric-input sites, the
  todo model decision, how completion of a repeating todo is stored, verification with
  logcat/store excerpts, anything left.
- `docs/STATUS.md`: TL;DR PR count and open branches; Known debt → strike "Numeric inputs
  coerce on every keystroke"; strike item 9 from "Next up"; Decisions on record → the todo
  repeat model; pass-9 log entry; replace this section with **the pass-10 handoff —
  Schedule view** (an agenda list of blocks across days; self-contained, no core changes;
  must use `eventsInRange()` / `expandSeries()` for repeat occurrences, never raw
  `events`).
- **Print the pass-10 handoff prompt in full in the chat too**, in one fenced block, as the
  last thing in the session (`CLAUDE.md` → Session workflow).
- Update the `device-and-tooling` memory note: Metro PID, phone IP/pin state, disk, any
  new traps.
