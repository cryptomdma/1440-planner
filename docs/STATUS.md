# Project Status

**Last updated: 2026-09-23** — read this first; it is the source of truth for project state.
The other docs describe *intent*, and some of it predates what actually shipped.

---

## TL;DR

The Expo app works and is genuinely usable: it persists data, fires punctual local
notifications, cold-starts on the Day screen, and as of pass 4 the todo → calendar PICK
flow actually places a linked block. Everything *around* it — watch sync, watch builds,
backend, web prototype, iOS — is scaffolding. Twelve PRs have merged; `fix/todo-pick-flow`
(pass 4, PR #13) is open.

---

## ✅ Working

**`packages/core` (`@1440/core`)** — platform-agnostic
- Types: `CalendarEvent`, `Todo`, `RepeatConfig`, `CATEGORIES`, `PRIORITIES`, `DESIGN_TOKENS`
- Utils: `computeLayout`, `findNextFreeSlot`, `autoScheduleQueue`, `expandRepeat`, time/date helpers
- Three zustand stores persisted via an injectable `StateStorage` adapter
  (keys `1440-planner-{calendar,todos,settings}-v1`)

**`apps/mobile`** — Expo SDK 51, expo-router, four tabs
- **Day** — 1440-minute grid, now-line, long-press-to-create, long-press-drag to move,
  top/bottom resize knobs (15-min snap + haptics), date strip with month grid, swipe
  between days, delete with 4s undo, next-block countdown, day progress stats
- **Tasks** — backlog with add form, AUTO ("schedule now"), AUTO-SCHEDULE ALL, and
  **PICK** (pass 4): Tasks → PICK pushes `/day?pick=<todoId>`; Day shows a placement
  banner naming the todo; long-press on a free slot creates the linked block there
  (`fromTodo`, `linkedTodoId`, todo → `scheduled`); CANCEL on the banner or any tab
  switch abandons it. All three paths share `apps/mobile/src/services/placeTodo.ts`.
  Deleting a placed block returns the todo to `pending`; UNDO re-links it.
- **Watch** — SVG watch-face *preview*, phone-side only
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
| **Watch sync transport** | `buildWatchSnapshot()` is complete and correct. Both platform bridges are `console.log` stubs — `apps/mobile/src/services/watchSync.ts:73-81`. No RN native module exists on either side. |
| **Wear OS watch face** | Real Kotlin (`WatchFaceService.kt`, `DataLayerClient.kt`, `ComplicationHelper.kt`) + `watchface.xml`, but **no `build.gradle` / `settings.gradle` / `AndroidManifest.xml`** — not an importable module, cannot compile. |
| **watchOS face** | Real Swift (`WatchFaceView.swift`, `WatchConnectivityManager.swift`, …) but **no `.xcodeproj` / `Package.swift` / `Info.plist`** — cannot compile. |
| **Backend** | `backend/supabase/` is three **0-byte** files. No `config.toml`, no client dependency. Directory names only. |
| **`docs/API_SPEC.md`** | Intentionally left empty — there is no backend to spec yet. |
| **Web prototype** | `apps/web/src/App.jsx` is 1370 real lines, but `index.html` and `src/main.jsx` are **0 bytes** and there is no `vite.config.js`. `npm run web` will not boot. It also does not use `@1440/core`. |

---

## 🐛 Known debt

**Dependency rot (highest risk).** Root `node_modules` holds **SDK 55** copies of
`expo-constants` (55.0.16), `expo-linking` (55.0.15), `react-native-screens` (4.24.0) and
`react-native-safe-area-context` (5.7.0) beside this **SDK 51** app, pulled in by
`expo-router@3.5.24` and hoisted by npm. `apps/mobile/metro.config.js` + root
`overrides` compensate. It works, but it is fragile and `package-lock.json` reproduces it
on a fresh install. **See `CLAUDE.md` before touching `metro.config.js`.** The real fix is
an SDK upgrade — a deliberate, self-contained future pass.

**`app.json` edits silently fail to reach the JS side.** The embedded `app.config` asset
(`Constants.expoConfig`, which expo-router and expo-linking read the scheme from) is written
by the Gradle task `:expo-constants:createExpoConfig`, which declares outputs but no inputs
and is therefore `UP-TO-DATE` forever after its first run. The first pass-3 rebuild updated
the manifest but not the JS for exactly this reason. Workaround and the check to make are in
`CLAUDE.md` ("`app.json` changes do NOT reach `Constants.expoConfig`"). Goes away with the
SDK upgrade (newer expo-constants marks the task always out-of-date).

**No dynamic `import()` anywhere in `packages/core`.** Metro serves a lazy `import()` as a
separate "split bundle" and builds its URL from the path relative to `apps/mobile`; for a
core file that is `..\..\packages\core\…`, which the dev server refuses (`Failed to load
split bundle`, surfaced as "Possible unhandled promise rejection"). Pass 4 hit this in
`useCalendarStore.deleteEvent` — the todo unlink silently never ran. Use static imports;
there are no cycles between the stores. Recorded in `CLAUDE.md`.

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
no rendering behavior in `DayGrid`. Repeat-series edit/delete scope has store support
(`deleteSeriesFromDate`) but no UI.

**Dead code.** `apps/mobile/src/navigation/RootNavigator.tsx` is 0 bytes — a leftover from a
react-navigation approach abandoned for expo-router. Safe to delete.

**No tests, no lint.** No test framework and no `check`/`lint` script in any
`package.json`. Verification is manual, on-device. `npx tsc --noEmit -p apps/mobile` and
`-p packages/core` are both clean as of pass 4 (the long-standing `useCalendarStore.ts`
dynamic-import error is gone with the import).

**Doc drift.** `docs/REPO_STRUCTURE.md` lists components that never existed
(`EventDetailSheet.tsx`, `TodoPlacementPanel.tsx`, `UndoToast.tsx`, `SettingsPanel.tsx`) and
a `packages/core/src/theme.ts` that was deliberately not created (see `DESIGN_TOKENS.md`).
`CLAUDE_CODE_HANDOFF.md` references a `scaffold.sh` that does not exist. Not yet corrected.

---

## Decisions on record

- **No `packages/core/src/theme.ts`.** `DESIGN_TOKENS` stays in `types/event.ts` so the
  palette has exactly one home. Overrides `CLAUDE_CODE_HANDOFF.md:566`.
- **Expo Go is not a supported path.** SDK 51 predates store Expo Go's supported range.
  Android dev build only.
- **`docs/API_SPEC.md` stays empty** until a backend exists.

---

## ➡️ Next up

Candidates for the next pass, ordered by leverage:

1. **Start Phase 6 watch sync.** Make `watch/android-wearos` a buildable Gradle project,
   then implement `WearableDataLayerModule` as an Expo local module and replace the Android
   stub in `apps/mobile/src/services/watchSync.ts:73-76`. This is the headline roadmap
   feature and the biggest single chunk of work. The pass-5 handoff prompt at the bottom of
   this file has the file-and-line detail.
2. **SDK upgrade off 51.** Resolves the dependency rot, re-enables Expo Go, and removes the
   `createExpoConfig` up-to-date trap. Invasive; deserves its own session with nothing else
   in it.

---

## Session log

### 2026-09-23 — Pass 4: todo → calendar PICK flow, Settings back fallback (+ two more bugs)
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

## 🤝 Handoff prompt (pass 5)

> Standing rule (`CLAUDE.md` → Session workflow): every session ends by replacing this
> section with the *next* session's prompt, in this format. Paste the block below as the
> opening message of the next session.

# 1440 Planner — Pass 5: Phase 6 watch sync, part 1 (Wear OS build + phone → watch Data Layer)

Read `CLAUDE.md` and `docs/STATUS.md` first. Both are current as of 2026-09-23. PR #13
(`fix/todo-pick-flow`, pass 4) should be merged by now — if it is not, stop and ask. The memory
note `device-and-tooling` holds the phone serial, adb path, tap coordinates and recipes
(including how to open a PR without `gh`); it is loaded into your context, use it.

## Prerequisites — check before writing anything

1. **This pass needs a native rebuild of the phone app** (it adds an Expo local module).
   Kill the Metro tree that has been on :8081 since pass 3 first:
   `Get-NetTCPConnection -LocalPort 8081 -State Listen` → `taskkill /PID <pid> /T /F`.
   Run the rebuild detached (`Start-Process cmd /c "npx expo run:android > log 2>&1"` from
   `apps/mobile`) and read the log; Gradle takes ~1.5 min warm, longer with a new module.
2. Phone: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices` → `R5CY72XEJKD`.
3. **The watch target is a Wear OS emulator — decided 2026-09-24; there is no physical
   watch.** Nothing Wear-related exists on the machine yet: `~/.android/avd` holds only
   `Medium_Phone_API_36.1`, `$env:LOCALAPPDATA\Android\Sdk\system-images` holds only
   `android-36.1/google_apis_playstore/x86_64`, and `Sdk\cmdline-tools` (hence
   `sdkmanager`/`avdmanager`) is **not installed**; only `Sdk\emulator\emulator.exe` is.
   - **Owner, before the session (5 min in Android Studio):** Device Manager → Create
     device → category *Wear OS* → *Wear OS Small Round* → system image API 34
     (`android-wear`, x86_64; download it there) → name it `Wear_API_34`. Also install the
     *Wear OS by Google* app on the Galaxy from Play (pairing UI lives there; Samsung's
     Galaxy Wearable app does not pair emulators).
   - **Session, first step:** `& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
     -list-avds` must print `Wear_API_34`. If it does not, the CLI fallback is: download
     `commandlinetools-win-*_latest.zip` from developer.android.com/studio, expand it to
     `Sdk\cmdline-tools\latest\` (the zip's inner `cmdline-tools` folder becomes `latest`),
     accept licences with `(1..30 | % {'y'}) | & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --licenses`,
     then `sdkmanager "system-images;android-34;android-wear;x86_64"` and
     `avdmanager create avd -n Wear_API_34 -k "system-images;android-34;android-wear;x86_64" -d wearos_small_round`.
   - **Boot and pair:** `Start-Process "$sdk\emulator\emulator.exe" -ArgumentList '-avd Wear_API_34'`
     (first boot takes minutes; `adb wait-for-device` on its serial, normally
     `emulator-5554`). Pair it with the *physical* Galaxy per
     developer.android.com/training/wearables/get-started/connect-phone: `adb -s R5CY72XEJKD
     forward tcp:5601 tcp:5601`, then on the phone open *Wear OS by Google* → add a new
     watch → pick the emulator. Both devices then show in `adb devices`; every watch
     command below uses `-s emulator-5554`. Fallback if pairing the physical phone fights
     you: pair the Wear AVD with the `Medium_Phone_API_36.1` AVD through Device Manager's
     pairing assistant and run `npx expo run:android` against that phone AVD instead (it is
     a `google_apis_playstore` image, so Play Services and the Data Layer are present).
   - Build the watch Gradle project first regardless — it does not need the emulator to
     compile.
4. Toolchain facts from the phone build — reuse them for the watch project so both use the
   same versions: Gradle 8.8 (`apps/mobile/android/gradle/wrapper/gradle-wrapper.properties`),
   AGP 8.2.1 (`node_modules/@react-native/gradle-plugin/gradle/libs.versions.toml:2`),
   Kotlin 1.9.23 and compileSdk/targetSdk 34 (`apps/mobile/android/build.gradle`), JDK 17 =
   Android Studio's `jbr` (`org.gradle.java.home` in `apps/mobile/android/gradle.properties`).
5. Branch from updated `main`: `git checkout main; git pull; git checkout -b feat/watch-sync-android`.

## Goal

`watch/android-wearos` becomes a Gradle project that compiles (`.\gradlew :app:assembleDebug`)
and installs on a Wear OS target; the phone app gets a real `WearableDataLayerModule` (an
Expo *local* module) that `syncToWatch()` calls; a calendar change on the phone reaches
`DataLayerClient.onDataChanged` on the watch and the face redraws its arcs. Closes STATUS
"Next up" #1 and rewrites the "Watch sync transport" and "Wear OS watch face" rows of the
"Scaffolded but NOT wired" table.

## Findings from pass 4 — do not re-derive

**Phone side, what exists.** `apps/mobile/src/services/watchSync.ts:6-21` is the
`WatchSnapshot` contract (`version`, `date`, `currentMinute`, `countMode`, `wakeMinute`,
`sleepMinute`, `events[{startMinute,durationMinutes,categoryId,color}]`, `currentBlock?`,
`nextBlock?`). `buildWatchSnapshot()` (`:23-62`) is complete. `syncToWatch()` (`:65-71`)
branches on `Platform.OS`; `syncAndroid()` (`:73-76`) is the stub to replace — its own TODO
names the call: `WearableDataLayerModule.sendSnapshot(JSON.stringify(snapshot))`.
`apps/mobile/src/app/_layout.tsx:66-81` subscribes to `useCalendarStore` and calls
`syncToWatch` on every calendar change and *only* then — nothing fires on a timer, so
`currentBlock`/`nextBlock` go stale between edits (the watch derives the minute from its own
clock, `WatchFaceService.kt:96`, so the arcs stay right). The stub logs
`[watchSync:android] <min> min` in dev; keep a dev log so the rebuild is checkable from logcat.

**Watch side, what exists.** `watch/android-wearos/app/src/main/java/com/planner1440/watchface/`:
- `DataLayerClient.kt` — a `WearableListenerService`. Expects a DataItem at path
  `/1440/snapshot` with string key `snapshot_json` (`:19-20`, `:26-37`) or a Message on the
  same path (`:39-45`), and rebroadcasts the JSON in-process (`:47-53`).
- `WatchFaceService.kt` — androidx `Renderer.CanvasRenderer2` (`:45-53`); parses the same
  keys as `WatchSnapshot` (`:97-138`); persists the JSON to SharedPreferences `1440_watch`
  for the complications (`:61-63`).
- `ComplicationHelper.kt` — `MinuteCounterComplicationService` (`:18`) and
  `NextBlockComplicationService` (`:56`), both `SuspendingComplicationDataSourceService`.
- `res/raw/watchface.xml` (Watch Face Format) and `res/xml/watch_face_info.xml`.

**Missing on the watch side:** `settings.gradle`, root `build.gradle`, `app/build.gradle`,
`gradle.properties`, the Gradle wrapper, `app/src/main/AndroidManifest.xml`, and
`res/drawable/watch_face_preview` — `watch_face_info.xml:3` references it, so resource
compilation fails until a PNG exists. Both watch `README.md` files are 0 bytes.

**Compile/runtime traps already visible in the Kotlin.**
- `WatchFaceService.kt:72-75` calls `registerReceiver(receiver, filter)` with no flags.
  With targetSdk ≥ 34 Android throws `SecurityException` for non-system broadcasts unless
  `Context.RECEIVER_NOT_EXPORTED` is passed. Fix it in the same pass.
- `WatchFaceService.kt:29` declares `class WatchFaceService : WatchFaceService()`, shadowing
  the androidx base pulled in by the wildcard import at `:10`. It compiles (the subclass wins
  in-file) but the manifest must name `com.planner1440.watchface.WatchFaceService`.
- Dependencies the imports require: `androidx.wear.watchface:watchface:1.2.1`,
  `androidx.wear.watchface:watchface-complications-data-source-ktx:1.2.1`,
  `com.google.android.gms:play-services-wearable:18.2.0`,
  `org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3`. minSdk 30 (Wear OS 3).
- Manifest needs: `<uses-feature android:name="android.hardware.type.watch"/>`;
  `<uses-library android:name="com.google.android.wearable" android:required="true"/>`;
  `<meta-data android:name="com.google.android.wearable.standalone" android:value="false"/>`;
  the watch face service with `android:permission="android.permission.BIND_WALLPAPER"`, the
  `android.service.wallpaper.WallpaperService` intent filter and the
  `android.service.wallpaper` meta-data pointing at `@xml/watch_face_info`; the two
  complication services with the
  `android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST` filter and
  `android.support.wearable.complications.SUPPORTED_TYPES` = `SHORT_TEXT`; `DataLayerClient`
  exported with `com.google.android.gms.wearable.DATA_CHANGED` and `MESSAGE_RECEIVED`
  actions plus `<data android:scheme="wear" android:host="*" android:pathPrefix="/1440"/>`.

**Where the phone-side native module must live.** `android/` is gitignored (root
`.gitignore`), so `docs/WATCH_FACE_ROADMAP.md:171-172`'s advice — a module under
`apps/mobile/android/app/src/main/java/` — would never be committed and any prebuild would
erase it. Use an **Expo local module** at `apps/mobile/modules/wearable-data-layer/`:
- `expo-module.config.json`:
  `{"platforms":["android"],"android":{"modules":["com.planner1440.wearable.WearableDataLayerModule"]}}`
- `android/build.gradle`: `com.android.library` + `kotlin-android`, `namespace
  'com.planner1440.wearable'`, `implementation 'com.google.android.gms:play-services-wearable:18.2.0'`
  (and `expo-modules-core` via the standard `implementation project(':expo-modules-core')`).
- `android/src/main/java/com/planner1440/wearable/WearableDataLayerModule.kt`: an
  `expo.modules.kotlin.modules.Module` whose definition has `Name("WearableDataLayer")` and
  `AsyncFunction("sendSnapshot") { json: String -> … }` doing
  `PutDataMapRequest.create("/1440/snapshot")`, `dataMap.putString("snapshot_json", json)`,
  `dataMap.putLong("ts", System.currentTimeMillis())` (the Data Layer only delivers when the
  bytes change — the timestamp keeps re-sends of an identical snapshot flowing),
  `.asPutDataRequest().setUrgent()`, then `Wearable.getDataClient(appContext.reactContext!!).putDataItem(...)`.
- `index.ts`: `export default requireNativeModule<{ sendSnapshot(json: string): Promise<void> }>('WearableDataLayer')`.
- Autolinking: `expo-modules-autolinking@1.11.3` (root `node_modules`) resolves
  `nativeModulesDir` to `./modules` by default
  (`node_modules/expo-modules-autolinking/build/autolinking/mergeLinkingOptions.js:72-79`),
  and `apps/mobile/android/settings.gradle:58` already calls
  `useExpoModules(exclude: ['expo-linking'])`, so the module links with **no** edit to the
  hand-maintained `settings.gradle`. Confirm in the build log that a
  `:wearable-data-layer:…` task runs.
- `syncAndroid()` becomes `try { await WearableDataLayer.sendSnapshot(JSON.stringify(snapshot)) } catch (e) { … }`
  with the dev log kept.

**Wearable Data Layer requirements.** Both APKs must be signed with the same certificate
(the debug keystore on both is fine for development) and the watch must be paired with this
phone. Different `applicationId`s are fine on Wear OS 3+. Use `com.planner1440.watchface`
for the watch (matches the Kotlin package).

**Watch Gradle layout.** A standalone project: `watch/android-wearos/settings.gradle`
(`pluginManagement` with `google()`/`mavenCentral()`, `include ':app'`), `build.gradle`
(`plugins { id 'com.android.application' version '8.2.1' apply false; id
'org.jetbrains.kotlin.android' version '1.9.23' apply false }`), `app/build.gradle`
(`namespace 'com.planner1440.watchface'`, compileSdk 34, minSdk 30, targetSdk 34),
`gradle.properties` (`android.useAndroidX=true`, the same `org.gradle.java.home` line as the
phone build), and the wrapper (`gradle/wrapper/*`, `gradlew`, `gradlew.bat`) copied from
`apps/mobile/android/` — those are gitignored only under `apps/mobile/android/`; commit them
under `watch/android-wearos/`.

## Constraints

- No `prebuild --clean`, no edits to `metro.config.js` or the two hand-edited files in
  `android/` (`CLAUDE.md`). A plain `npx expo run:android` picks up the local module.
- `packages/core` untouched. `WatchSnapshot` (`watchSync.ts:6-21`) is the contract; if the
  watch needs a new field, add it in `buildWatchSnapshot` and bump `version`.
- Android only. `syncIOS()` stays a stub; `watch/apple-watchos` is a later pass.
- The face's *look* is out of scope — it only has to render the snapshot it receives.
- Design tokens are irrelevant on the watch side, but do not add new hex values to the app.

## Verification (required; on the Wear OS emulator, serial `emulator-5554` unless `adb devices` says otherwise)

0. `adb devices` lists both `R5CY72XEJKD` and the emulator, and the Wear OS app on the
   phone shows the emulator as connected. Screenshot the emulator once paired.
1. `cd watch/android-wearos; .\gradlew :app:assembleDebug` succeeds; `adb -s <watch> install -r`
   the APK; the face is selectable on the watch. Screenshot it (`adb -s <watch> shell screencap`).
2. Phone rebuild log shows `:wearable-data-layer:compileDebugKotlin` (or similar) and the app
   cold-starts on Day.
3. Create or move a block on today → phone logcat `[watchSync:android] <min> min` → watch
   logcat (`adb -s <watch> logcat -s 1440:DataLayer 1440:WatchFace`) shows
   `Received snapshot, currentMinute=…` and the face redraws with the new arc.
4. Delete the block → the arc disappears on the watch.
5. `am force-stop com.planner1440.watchface` on the watch → the minute-counter complication
   still shows a value (SharedPreferences path, `ComplicationHelper.kt:49-53`).
6. `npx tsc --noEmit -p apps/mobile` still clean (type the module's export in `index.ts`).

## Wrap-up

- Conventional Commits, e.g. `feat(watch): gradle project, manifest and preview for the
  Wear OS face`, `fix(watch): RECEIVER_NOT_EXPORTED for the snapshot receiver`,
  `feat(watch-sync): WearableDataLayer local Expo module`, `feat(watch-sync): send
  snapshots over the Data Layer on Android`, `docs: …`.
- Push, open a PR through the GitHub API (no `gh`; recipe in the memory note), **do not
  merge**. PR description: what changed, why the local-module layout instead of
  `android/app/src/main/java`, which watch target was used, verification with logcat
  excerpts, anything left undone (timer-driven resync, iOS, WFF vs Canvas).
- `docs/STATUS.md`: TL;DR PR count and open branch; rewrite the two "Scaffolded but NOT
  wired" rows; add "(PR #N, merged `sha`)" to the pass-4 heading; remove "Next up" #1 and
  renumber; add a pass-5 log entry; replace this section with the pass-6 handoff prompt
  (candidates: SDK upgrade off 51, or timer-driven watch resync + `syncIOS` via
  WatchConnectivity).
- Update the `device-and-tooling` memory note with the emulator's serial, the pairing steps
  that actually worked, and the emulator boot time.
