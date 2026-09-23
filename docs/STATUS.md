# Project Status

**Last updated: 2026-09-22** — read this first; it is the source of truth for project state.
The other docs describe *intent*, and some of it predates what actually shipped.

---

## TL;DR

The Expo app works and is genuinely usable. Everything *around* it — watch sync, watch
builds, notifications, backend, web prototype, iOS — is scaffolding. Nine PRs have merged;
`main` is clean.

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
- **Settings** — count mode, default duration, auto-schedule buffer, wake/sleep minutes
  (reachable only via the gear on the Day screen, not the tab bar)
- Persistence across restarts, with a hydration gate in `_layout.tsx`

---

## 🚧 Scaffolded but NOT wired

| Area | State |
|---|---|
| **Watch sync transport** | `buildWatchSnapshot()` is complete and correct. Both platform bridges are `console.log` stubs — `apps/mobile/src/services/watchSync.ts:73-81`. No RN native module exists on either side. |
| **Wear OS watch face** | Real Kotlin (`WatchFaceService.kt`, `DataLayerClient.kt`, `ComplicationHelper.kt`) + `watchface.xml`, but **no `build.gradle` / `settings.gradle` / `AndroidManifest.xml`** — not an importable module, cannot compile. |
| **watchOS face** | Real Swift (`WatchFaceView.swift`, `WatchConnectivityManager.swift`, …) but **no `.xcodeproj` / `Package.swift` / `Info.plist`** — cannot compile. |
| **Local notifications** | `apps/mobile/src/services/notifications.ts` is fully implemented and **imported nowhere**. No call site, no startup permission request. Cheapest real win available. |
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

1. **Wire up local notifications.** The service is already written; it needs a call site,
   a startup permission request, and a lead-time setting. Closes a Definition-of-Done item
   and a roadmap item for very little code.
2. **Fix the todo → calendar pick flow** (`tasks.tsx:10`). Small, user-visible bug fix —
   route param or a shared store field instead of local state.
3. **Start Phase 6 watch sync.** Add `build.gradle` to `watch/android-wearos` so it compiles,
   then implement `WearableDataLayerModule` and replace the Android stub. This is the
   headline roadmap feature and the biggest single chunk of work.
4. **SDK upgrade off 51.** Resolves the dependency rot and re-enables Expo Go. Invasive;
   deserves its own session with nothing else in it.

---

## Session log

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

**On-device verification: not yet run** — no Android device was connected during this
session (`adb devices` empty). Next session: connect a phone with USB debugging and run
`cd apps/mobile; npx expo run:android`, then update this entry with the result.
