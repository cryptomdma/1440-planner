# 1440 Planner — Working Conventions

Read this first. It records rules and traps that are **not** derivable from the code.

---

## Git workflow

- **Never commit or push to `main`.** No exceptions.
- Every change goes: branch → commit → push → **open a PR**. **The repo owner merges.**
  Do not merge your own PR, and do not use `--admin` or any auto-merge.
- **Always write a PR description after pushing.** State what changed, why, and how it was
  verified. Call out anything intentionally left undone.
- Never use `--no-verify`, `--force` on a shared branch, or `git commit --amend` on pushed
  commits.

### Branch naming

`feat/`, `fix/`, `docs/`, `chore/` + kebab-case slug — e.g. `feat/drag-resize`.

History contains both `feat/` and `feature/` (and one `debug/`). **Standardise on `feat/`**
going forward; don't retrofit old branches.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), matching existing history:

```
feat(drag-resize): long-press drag + top/bottom resize knobs on event blocks
fix(drag-resize): knobs absolute-positioned so text is never obscured
docs: refresh roadmap checkboxes to match shipped work
```

---

## Session workflow

Work happens in **1–2 passes per session**, so continuity matters more than speed:

- Start by reading `docs/STATUS.md` — it is the source of truth for project state.
- **End every session by updating `docs/STATUS.md`** with what changed and what's next.
- **End every session by writing the *next* session's handoff prompt.** It is the final
  section of `docs/STATUS.md`, titled `## 🤝 Handoff prompt (pass N+1)`, and it
  **replaces** the previous one each session. Use the format that section already has:
  prerequisites (Metro/device/branch checks), goal, findings-do-not-re-derive (with
  file-and-line citations), constraints, verification steps, wrap-up. It must be detailed
  enough that a fresh session can act on it without re-deriving context.
- Cite files as `path/to/file.ts:42` so they're clickable.

---

## Dev commands

```bash
npm install                       # from repo root

cd apps/mobile
npx expo run:android              # build + install + run on a connected device
npx expo start                    # bundler only (app already installed)

npm run mobile                    # from root: same as `expo start` in apps/mobile
```

**Never run `npx expo start` from the repo root.** The root is a workspace manifest with no
Expo entry point. A stray root `app.json` used to exist purely to make that wrong command
look valid; it was deleted. If you find one there again, delete it — the real config is
`apps/mobile/app.json`.

Gradle uses Android Studio's bundled JDK 17 (`org.gradle.java.home` in
`apps/mobile/android/gradle.properties`). The system `java` on `PATH` does not matter.

**Expo Go does not work** — the app is pinned to SDK 51 and store Expo Go only supports the
current SDK. Use the dev build.

---

## Load-bearing code — do not "clean up"

### `apps/mobile/metro.config.js`

This file looks like cruft. It is not. Root `node_modules` contains **SDK 55** copies of
`expo-constants`, `expo-linking`, `react-native-screens` and `react-native-safe-area-context`
sitting beside this **SDK 51** app, because `expo-router@3.5.24` drags them in and npm
hoists them. `metro.config.js` compensates with three mechanisms:

- `resolver.nodeModulesPaths` — app-local `node_modules` resolved before root
- `resolver.blockList` — hard-blocks the root copies of `react-native-screens` and
  `react-native-safe-area-context`
- `resolver.resolveRequest` — redirects `expo-linking` to the local 6.3.1 (pure-JS) copy,
  and re-resolves HMR's `./node_modules/…` paths against the repo root

Removing any of it breaks the build in non-obvious ways. The root `package.json`
`overrides` block is part of the same workaround.

The real fix is upgrading off SDK 51, which is a deliberate future pass — see
`docs/STATUS.md`.

### `apps/mobile/android/settings.gradle` and `gradle.properties` — hand-edited

`android/` is generated and gitignored, but two files in it carry hand edits that
`npx expo prebuild` regenerates and **silently loses**:

- `settings.gradle` — `useExpoModules(exclude: ['expo-linking'])`. The `expo-linking` native
  module is deliberately excluded to dodge an `expo-module-gradle-plugin` incompatibility.
  This is why `metro.config.js` must redirect `expo-linking` to a pure-JS version.
- `gradle.properties` — `org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr`.
  Without it Gradle picks the system `java`, which is not JDK 17.

**Never run `prebuild --clean`.** For manifest-level changes (URL scheme, permissions), edit
`app.json` *and* hand-edit `android/app/src/main/AndroidManifest.xml` to match, then run
`npx expo run:android`. If you do run `npx expo prebuild --platform android` (no `--clean`),
diff and re-apply both edits before building. This is how the pass-3 scheme rename was done
(2026-09-23).

### `app.json` changes do NOT reach `Constants.expoConfig` on their own

The JS side reads `scheme`, `plugins`, etc. from an `app.config` asset that the Gradle task
`:expo-constants:createExpoConfig` writes (expo-constants 16.0.2,
`node_modules/expo-constants/scripts/get-app-config-android.gradle`). That task declares an
output dir and **no inputs**, so once it has run Gradle reports it `UP-TO-DATE` forever —
the asset on the device was five months stale before pass 3, and the first rebuild of the
scheme rename changed the manifest but not the JS. Before any build that must pick up an
`app.json` change, delete
`apps/mobile/node_modules/expo-constants/android/build/generated/assets/expo-constants/`
and confirm the build log shows `> Task :expo-constants:createExpoConfig` **without**
`UP-TO-DATE`. (The root `node_modules/expo-constants` is the SDK 55 copy whose script is
always out-of-date — it is not the one this build uses.)

---

## Repo shape

- npm **workspaces** monorepo: `packages/*`, `apps/*`
- `packages/core` (`@1440/core`) — types, utils and zustand stores; platform-agnostic
- `apps/mobile` — the Expo app (**this is the product**)
- `apps/web` — an early React prototype, **currently broken** (0-byte entry files)
- `watch/` — Wear OS + watchOS source with **no build system** yet
- `backend/` — empty scaffolding (0-byte files)

`android/` and `ios/` are gitignored — native dirs are local build artifacts produced by
`expo prebuild` / `expo run:android`.

---

## Conventions in the code

- **Dark mode only.** Light mode is a tracked future milestone.
- Design tokens live in `packages/core/src/types/event.ts` (`DESIGN_TOKENS`, `CATEGORIES`,
  `PRIORITIES`). That is the single source of truth — **do not create a second
  `theme.ts`**, and do not hardcode hex values in components.
- Time is **minutes from midnight (0–1439)**, not clock time. Convert only at the display
  edge, via the helpers in `packages/core/src/utils/time.ts`.
- Grid constants (`PPM`, `BLOCK_SIZE`, `RULER_W`) come from core — never inline them.
- **No dynamic `import()` in `packages/core`.** Metro serves a lazy import as a split bundle
  whose URL is the path relative to `apps/mobile`; for core that is `..\..\packages\core\…`
  and the dev server rejects it (`Failed to load split bundle`, a "Possible unhandled
  promise rejection" toast, and the code after the import silently never runs). Use static
  imports — there are no cycles between the stores. Found in pass 4.
- Touch targets inside `DayGrid`'s long-press `Pressable` must be `pointerEvents="none"`
  (shading, ruler, now-line). `nativeEvent.locationY` is relative to the *touched* view, so
  any child that accepts touches makes the computed minute wrong.
- No test framework is configured, and there is no `check`/`lint` script. Verify changes by
  running the app on a device.
- **`npx tsc -p apps/mobile` can fail on `.expo/types/router.d.ts` after you create files
  outside `src/app` while Metro is running** (expo-router's typed-routes watcher writes
  backslash "routes" for them). Not a real error: restart Metro, which regenerates the file,
  then re-run `tsc`. Found in pass 5.
- Native code for the phone goes in an **Expo local module under `apps/mobile/modules/`**,
  never under `apps/mobile/android/` (gitignored, erased by prebuild). Root `.gitignore`
  has a bare `android/` rule and a `!apps/mobile/modules/**/android/` negation for exactly
  this — keep both.

---

## Watch — `watch/android-wearos`

- Two Gradle modules: **`:app`** (the code — Data Layer listener, complication data
  sources, an androidx Canvas face) and **`:wff`** (a no-code Watch Face Format face). Build
  with `.\gradlew :app:assembleDebug :wff:assembleDebug` from that directory.
- **Wear OS 5+ launch devices block third-party androidx/Canvas faces.** The owner's Galaxy
  Watch 7 logs `WatchFacesRestrictionManagerImpl … is blocked` for `WatchFaceService.kt`
  and never lists it. Only the `:wff` face renders there; do not debug the Canvas renderer
  on that device.
- `:app`'s `applicationId` **must equal the phone's** (`com.planner1440.app`) and both must
  sign with `app/debug.keystore` (a copy of the phone's RN debug keystore): the Wearable
  Data Layer only routes between the two halves of one app.
- `wff/src/main/res/raw/watchface.xml` and the preview/icon PNGs are **generated** —
  `tools/make-watchface.ps1` and `tools/make-preview.ps1`. Edit the generators.
- Wi-Fi ADB only (pairing-code flow); connect details, the first-time picker recipe and the
  `DEBUG_SURFACE` switch broadcast are in the watch README and `docs/STATUS.md`.
