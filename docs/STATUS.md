# Project Status

**Last updated: 2026-09-23** — read this first; it is the source of truth for project state.
The other docs describe *intent*, and some of it predates what actually shipped.

---

## TL;DR

The Expo app works and is genuinely usable: it persists data, fires punctual local
notifications, and as of pass 3 it cold-starts on the Day screen instead of "Unmatched
Route". Everything *around* it — watch sync, watch builds, backend, web prototype, iOS — is
scaffolding. Eleven PRs have merged; `fix/url-scheme-rebuild` (pass 3) is open.

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
- **Tasks** — backlog with add form, "schedule now", and "auto-schedule all"
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

**Settings "SAVE & CLOSE" is `router.back()`.** When Settings is the *first* screen (a
`planner1440:///settings` deep link, or a notification-style entry), there is nothing to go
back to and dev builds show a "GO_BACK was not handled" LogBox toast. The normal gear →
Settings → close path is unaffected. Fix: fall back to `router.replace('/day')` when
`router.canGoBack()` is false.

*Fixed in pass 3 (kept for history):* the digit-leading URL scheme `1440planner` that made
every cold start land on "Unmatched Route"; reminders firing 18–61 s late without an
exact-alarm permission; reminder taps not being handled. See the 2026-09-23 pass-3 log.

**No iOS path at all.** No `ios/` directory, no `eas.json`, no EAS project id. Getting onto
an iPhone requires either a Mac for a local build or setting up EAS Build. Not started.

**Broken todo → calendar "pick" flow.** `apps/mobile/src/app/tasks.tsx:10` stores
`pendingTodoId` in local component state, then navigates to `/day` — which never receives
it. The selection is silently lost. User-visible bug.

**Unimplemented settings.** `highlightConflicts` has a Settings toggle and store field but
no rendering behavior in `DayGrid`. Repeat-series edit/delete scope has store support
(`deleteSeriesFromDate`) but no UI.

**Dead code.** `apps/mobile/src/navigation/RootNavigator.tsx` is 0 bytes — a leftover from a
react-navigation approach abandoned for expo-router. Safe to delete.

**No tests, no lint.** No test framework and no `check`/`lint` script in any
`package.json`. Verification is manual, on-device.

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

1. **Fix the todo → calendar pick flow** (`apps/mobile/src/app/tasks.tsx:10`). Small,
   user-visible bug fix — route param or a shared store field instead of local state.
   JS-only; reuse the Metro that `expo run:android` leaves on :8081, no rebuild needed.
   While in `tasks.tsx`/`day.tsx`, also make Settings' SAVE & CLOSE fall back to
   `router.replace('/day')` when `router.canGoBack()` is false (Known debt).
2. **Start Phase 6 watch sync.** Add `build.gradle` to `watch/android-wearos` so it compiles,
   then implement `WearableDataLayerModule` and replace the Android stub. This is the
   headline roadmap feature and the biggest single chunk of work.
3. **SDK upgrade off 51.** Resolves the dependency rot, re-enables Expo Go, and removes the
   `createExpoConfig` up-to-date trap. Invasive; deserves its own session with nothing else
   in it.

---

## Session log

### 2026-09-23 — Pass 3: URL scheme rename + native rebuild, exact alarms, reminder taps
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
