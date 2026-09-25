# Project Status

**Last updated: 2026-09-24** — read this first; it is the source of truth for project state.
The other docs describe *intent*, and some of it predates what actually shipped.

---

## TL;DR

The Expo app works and is genuinely usable: it persists data, fires punctual local
notifications, cold-starts on the Day screen, and the todo → calendar PICK flow places a
linked block. **Android watch sync is verified on hardware as of pass 6:** the
`WearableDataLayer` Expo local module on the phone writes a `WatchSnapshot` to the Wearable
Data Layer on every calendar/settings change, once a minute while the app is open, and on
foreground; `watch/android-wearos`'s `DataLayerClient` on the owner's Galaxy Watch 7
receives each one 3.5–4 s later and refreshes the two complications its Watch Face Format
face shows. Backend, web prototype and iOS are still scaffolding. Seventeen PRs have
merged (passes 1–5 plus the pass-6 handoff docs); `feat/watch-sync-resync` (PR #18,
pass 6) is open.

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
| **Wear OS watch face** | **Builds, installs, renders and receives live data (passes 5–6).** `watch/android-wearos` = `:app` (`com.planner1440.app`: Data Layer listener + two complication data sources + the androidx Canvas face, which **Wear OS 6 blocks outright**) and `:wff` (`com.planner1440.wff`: the no-code Watch Face Format face that actually shows, fed by those complications). Shows 24 h sweep, minute hand, minute counter and next block — **not per-block arcs** (Known debt). |
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

**The WFF face cannot draw per-block arcs, and its minute counter is a complication.**
Watch Face Format has no way to render N arbitrary arcs from a JSON snapshot, so the face
shows the 24-hour sweep, the minute hand, the minute counter (slot 1) and the next block
(slot 2). Complication `UPDATE_PERIOD_SECONDS=60` never fires on the Galaxy Watch 7 (the
platform clamps to 300 s); `DataLayerClient` calls `requestUpdateAll()` on every snapshot,
which is the real refresh path, and since pass 6 the phone resends once a minute while its
app is foregrounded — so the counter is at most a minute stale while the phone app is open,
and up to 5 min once it is backgrounded (the timer stops there by design; see Next up).
Options for arcs: one `RANGED_VALUE` slot per block (bounded count) or a phone-rendered
bitmap complication. Not started.

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
no rendering behavior in `DayGrid`. Repeat-series edit/delete scope has store support
(`deleteSeriesFromDate`) but no UI.

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

- **No `packages/core/src/theme.ts`.** `DESIGN_TOKENS` stays in `types/event.ts` so the
  palette has exactly one home. Overrides `CLAUDE_CODE_HANDOFF.md:566`.
- **Expo Go is not a supported path.** SDK 51 predates store Expo Go's supported range.
  Android dev build only.
- **`docs/API_SPEC.md` stays empty** until a backend exists.

---

## ➡️ Next up

Candidates for the next pass, ordered by leverage:

1. **SDK upgrade off 51.** Resolves the dependency rot, re-enables Expo Go, and removes the
   `createExpoConfig` up-to-date trap. Invasive; deserves its own session with nothing else
   in it — the pass-7 handoff below is written for it.
2. **Per-block arcs on the WFF face** (Known debt) — a design pass; the transport it needs
   is now verified end to end.
3. **Watch resync while the phone app is backgrounded** (Known debt) — native-side timer
   or watch-side current/next computation.
4. **`syncIOS` via WatchConnectivity** — blocked on an iOS build path (no Mac, no EAS).

---

## Session log

### 2026-09-24 — Pass 6: Phase 6 watch sync, part 2 — phone → watch verified, resync timer (PR #18)
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

## 🤝 Handoff prompt (pass 7)

> Standing rule (`CLAUDE.md` → Session workflow): every session ends by replacing this
> section with the *next* session's prompt, in this format. Paste the block below as the
> opening message of the next session.

# 1440 Planner — Pass 7: Expo SDK upgrade off 51 (dependency rot, `createExpoConfig` trap, Expo Go)

Read `CLAUDE.md` and `docs/STATUS.md` first. Both are current as of 2026-09-24. PR #18
(`feat/watch-sync-resync`, pass 6) should be **merged** — check `git log main` for
`feat(watch-sync): resync every minute and on foreground`. If it is not there, branch from
`feat/watch-sync-resync` instead (this pass edits `_layout.tsx` too) and say so in the PR.
The memory note `device-and-tooling` holds the phone serial, adb path, both devices' fixed
`:5555` ports, the watch wake/screen-timeout recipe, the unfiltered-logcat recipe (tags
with a colon cannot be `-s`-filtered), the notification and PICK test recipes and how to
open a PR without `gh`; it is loaded into your context, use it.

## Prerequisites — check before writing anything

1. **Phone** `R5CY72XEJKD` in `adb devices` (USB, or `adb connect 192.168.1.91:5555`);
   always pass `-s`. Re-issue `adb -s R5CY72XEJKD reverse tcp:8081 tcp:8081` after every
   install — without it the dev build shows the red "Unable to load script" screen.
   Check `dumpsys window | findstr mCurrentFocus` before any tap sequence: the owner uses
   the phone during sessions.
2. **Watch** `adb connect 192.168.1.68:5555`. If `offline`, `adb disconnect` + `connect` in
   a loop with 8 s pauses, then `input keyevent KEYCODE_WAKEUP` and
   `settings put system screen_off_timeout 1800000` (put `60000` back at the end). The
   watch is **not** a target of this pass — it is the regression check for the sync.
3. **Metro.** Pass 6 left a detached `cmd /c npx expo start` (cmd PID 30188) on :8081.
   This pass rebuilds native code and changes `metro.config.js`, so kill the tree first:
   `taskkill /PID 30188 /T /F`; verify with `Get-NetTCPConnection -LocalPort 8081 -State
   Listen`.
4. **JDK.** `apps/mobile/android/gradle.properties` carries
   `org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr` (JDK 17). Newer
   SDK templates still want 17; keep that line whatever else prebuild regenerates.
5. Branch: `git checkout main; git pull; git checkout -b chore/sdk-upgrade`.

## Goal

Move `apps/mobile` from Expo SDK 51 to the current SDK — root `node_modules` already holds
SDK 55 packages, so 55 is the natural target; step down to 52 only if 55 fails outright —
delete the three workarounds that exist purely because of the version mix, and prove the
app on the phone is unchanged, including watch sync. Closes STATUS "Next up" #1 and two
Known-debt paragraphs ("Dependency rot", "`app.json` edits silently fail").

## Findings — do not re-derive

**Where the rot is.** `apps/mobile/package.json:15-28` pins SDK 51: `expo ~51.0.0`,
`expo-router ~3.5.0`, `react-native 0.74.0`, `react 18.2.0`, `expo-notifications ~0.28.0`,
`expo-constants ~16.0.0`, `expo-linking ~6.3.1`, `expo-haptics ~13.0.0`,
`react-native-screens ~3.31.1`, `react-native-safe-area-context ~4.10.1`,
`react-native-reanimated ~3.10.0`, `react-native-gesture-handler ~2.16.0`,
`react-native-svg ~15.2.0`, `@react-native-async-storage/async-storage ^1.23.0`. Root
`package.json:13-19` has an `overrides` block forcing `expo-constants 16.0.2`,
`expo-linking 6.3.1`, `react-native-screens ~3.31.1`, `react-native-safe-area-context
~4.10.1`, `react-native-svg ~15.2.0` — and root `node_modules` *still* ends up with SDK 55
copies of the first four (`CLAUDE.md` → Load-bearing code). That mix is why
`apps/mobile/metro.config.js` looks the way it does.

**The three workarounds to delete once versions are coherent** — all in
`apps/mobile/metro.config.js`: `resolver.nodeModulesPaths` (`:12-15`),
`resolver.blockList` for the root `react-native-screens` / `react-native-safe-area-context`
(`:20-26`), and the `resolver.resolveRequest` override (`:39-67`) that redirects
`expo-linking` to the local pure-JS copy and re-resolves HMR's `./node_modules/…` paths.
**Keep** `watchFolders` (`:7-8`) and `extraNodeModules['@1440/core']` (`:28-31`) — those are
the monorepo, not the rot. Delete the root `overrides` block in the same commit, `npm
install` from the root, and confirm one version each with `npm ls expo-constants
expo-linking react-native-screens react-native-safe-area-context`.

**Two hand edits in the gitignored `android/` exist only for the mix** (`CLAUDE.md`):
`settings.gradle` → `useExpoModules(exclude: ['expo-linking'])` (the SDK 55 `expo-linking`
did not build with the SDK 51 `expo-module-gradle-plugin`) and `gradle.properties` →
`org.gradle.java.home`. **This is the one pass where regenerating `android/` is right:**
`npx expo prebuild --platform android` (still no `--clean`; diff first). Expect the
`expo-linking` exclusion to become unnecessary — drop it. Re-apply `org.gradle.java.home`.
Check the regenerated `AndroidManifest.xml` still has `<data android:scheme="planner1440"/>`
and `android.permission.USE_EXACT_ALARM` — both come from `app.json`, so prebuild should
emit them; pass 3 had to hand-fix exactly those two when prebuild was skipped.

**The `createExpoConfig` trap should disappear** with a newer `expo-constants` (upstream
marks the task always out-of-date). Prove it on the first build: the Gradle log must show
`> Task :expo-constants:createExpoConfig` **without** `UP-TO-DATE`, and a cold start must
land on Day — "Unmatched Route" is the symptom of a stale asset. Delete
`apps/mobile/node_modules/expo-constants/android/build/generated/assets/expo-constants/`
before the build regardless, as `CLAUDE.md` says.

**Code that touches version-sensitive APIs — check each against the installed types
after the bump, do not assume:**
- `apps/mobile/src/app/_layout.tsx` — `useRootNavigationState()?.key` gate (expo-router 3
  → 6), `Notifications.getLastNotificationResponseAsync` /
  `clearLastNotificationResponseAsync` (expo-notifications 0.28 → current; the clear
  function has been reshuffled in later versions — if it is gone, guard by response
  identifier instead), `AppState.addEventListener('change')` subscription (fine),
  `useCurrentMinute` / `getCurrentMinute` from core (fine).
- `apps/mobile/src/services/notifications.ts` — the trigger object shape for
  `scheduleNotificationAsync` changed in later expo-notifications (typed
  `SchedulableTriggerInputTypes`); `setNotificationChannelAsync` unchanged. Pass 3's 76 ms
  exact-alarm result is the bar.
- `apps/mobile/modules/wearable-data-layer/` — `expo-modules-core` `Module` /
  `ModuleDefinition` / `AsyncFunction` + `Promise` are stable; `requireOptionalNativeModule`
  from `expo` still exists. `android/build.gradle` applies `expo-module-gradle-plugin`;
  its template changed after SDK 51 — if configuration fails, compare against a fresh
  `npx create-expo-module --local` output rather than guessing.
- `packages/core` — `zustand ^4.5` is fine on React 18.3; if the SDK brings React 19,
  watch the `create<T>()(persist(...))` typings and `useSyncExternalStore` warnings.
- `react-native-reanimated` → the SDK's version; `babel.config.js` keeps its plugin last
  (later SDKs move it to `react-native-worklets` — follow `npx expo install --fix` and
  `npx expo-doctor`, which say so).
- **New Architecture** is on by default from SDK 52. All four RN libs here support it. If
  `DayGrid`'s long-press `Pressable` + `nativeEvent.locationY` maths breaks, set
  `"newArchEnabled": false` in `app.json` first and note it — do not rewrite `DayGrid` in
  this pass.

**How to do the bump.** `cd apps/mobile; npx expo install expo@^55 --fix` (or `@^52`)
rewrites every Expo-managed dependency to the matching version, then `npx expo-doctor`.
expo-router 6 still exports `Slot`, `usePathname`, `useRouter`, `useLocalSearchParams`,
`router.setParams` (pass 4 relies on it) and writes `.expo/types/router.d.ts` the same way
(same typed-routes trap: restart Metro before `tsc` if it shows backslash routes).

## Constraints

- One session, nothing else in it (`STATUS.md` → Next up #1). No feature work.
- Do not touch `watch/android-wearos` — it is the regression check, not a target.
- `DESIGN_TOKENS` stays in `packages/core/src/types/event.ts`; no `theme.ts`.
- No dynamic `import()` in `packages/core` (`CLAUDE.md`).
- `CLAUDE.md` must change in the same PR: its `metro.config.js` section, the two-hand-edits
  section and the `createExpoConfig` section all describe the pre-upgrade state. Rewrite
  them to what is still true (probably only `org.gradle.java.home` and the "diff before
  and after `prebuild`, never `--clean`" rule).

## Verification (required; `<watch>` = `192.168.1.68:5555`)

0. `adb devices` lists `R5CY72XEJKD` and `<watch>`.
1. `npx expo run:android` (Metro killed first) builds; the Gradle log shows
   `:expo-constants:createExpoConfig` executed (not `UP-TO-DATE`) and
   `:wearable-data-layer:compileDebugKotlin`.
2. Cold start (`am force-stop` + launcher) → Day, 3×. `planner1440:///settings` → Settings;
   ✕ → Day. No LogBox.
3. Data survived: the pass-2/3 `OtherDay3` block on 2026-09-24 and the settings are still
   there (same debug keystore). `pm clear` is the rollback if hydration breaks — say so.
4. Notifications: lead 0, block 3 min out → posted within ~100 ms of the minute (recipe in
   the memory note); tap with the process killed (`am kill`, not `force-stop`) → Day on the
   block's date.
5. PICK flow: Tasks → `+ TASK` → PICK → long-press a free slot → linked block; delete →
   todo back to PENDING (pass-4 recipe in the memory note).
6. Watch sync regression (unfiltered logcat on both, memory note): create a block on today
   ≥ 30 min out → phone `1440:WatchSync putDataItem ok` → watch `1440:DataLayer Received
   snapshot` within ~4 s → `DWF:WearComplicationProvider [12:TEXT] "<title> <time>"`; then
   2 min of no edits → two more `Received snapshot` lines from the timer.
7. `npx tsc --noEmit -p apps/mobile` and `-p packages/core` clean; `npx expo-doctor` clean.
8. `metro.config.js` is down to `watchFolders` + `extraNodeModules`; the root `overrides`
   block is gone; `git diff --stat main` shows both.

## Wrap-up

- Conventional Commits: `chore(sdk): upgrade to Expo SDK 55`, `chore(sdk): drop the SDK 51
  resolver workarounds`, `docs: pass-7 …`.
- Push, open the PR through the GitHub API (no `gh`; recipe in the memory note), **do not
  merge**. PR description: before/after versions, what was deleted, the
  Gradle/`createExpoConfig` evidence, the verification list with logcat excerpts, anything
  left (New Architecture off? `syncIOS`, arcs, background resync).
- `docs/STATUS.md`: TL;DR PR count and open branch; Known debt → remove "Dependency rot"
  and "`app.json` edits silently fail"; "Next up" renumber (arcs, background resync, iOS);
  pass-7 log entry; replace this section with the pass-8 handoff (candidates: per-block
  arcs via `RANGED_VALUE` slots; background resync from the native module; `syncIOS`).
- **Print the pass-8 handoff prompt in full in the chat too**, in one fenced block, as the
  last thing in the session (`CLAUDE.md` → Session workflow).
- Update the `device-and-tooling` memory note: new Metro PID, whether both `:5555` pins
  survived, any new build traps, the screen-timeout restore.

