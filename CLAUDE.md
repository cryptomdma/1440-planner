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
- **Also print that handoff prompt in full in the chat, as the last thing you do.** Writing
  it to `docs/STATUS.md` is not enough on its own — the repo owner starts the next session by
  pasting it, so it has to be copyable straight from the conversation. Put it in one fenced
  block, verbatim and complete, after the closing summary. Both places, every time.
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

Gradle uses Android Studio's bundled JBR (currently **JDK 21**) via `org.gradle.java.home` in
`apps/mobile/android/gradle.properties`. The system `java` on `PATH` is JDK 11 and would be
rejected by Gradle 9.x — that line is what keeps the build working, so keep it pointed at a
JBR that exists.

The first build after a dependency change **downloads NDK 27.1.12297006 (~2.2 GB)** and can
fail once with `[CXX1101] NDK … did not have a source.properties file` if the check races the
download. Re-run; it succeeds. A full native build also needs **several GB of free disk** —
`mergeDebugNativeLibs` fails with `There is not enough space on the disk` rather than
anything that names disk as the cause.

**Expo Go:** the SDK 51 pin that ruled it out is gone (the app is on the current SDK since
pass 7), but Expo Go has **not been tried** and cannot run the app as-is — `WearableDataLayer`
is a local native module, so watch sync needs the dev build regardless. Keep using
`npx expo run:android`.

---

## Load-bearing code — do not "clean up"

### `apps/mobile/metro.config.js` — now only the monorepo, keep it that way

Until the pass-7 SDK upgrade this file carried three resolver workarounds for a version mix
(SDK 55 packages hoisted beside an SDK 51 app). **They are gone, along with the root
`package.json` `overrides` block that went with them.** What is left is only monorepo wiring
and both lines are load-bearing:

- `watchFolders` — `packages/core` lives outside the Metro project root, so without this Fast
  Refresh never sees edits to core.
- `resolver.extraNodeModules['@1440/core']` — maps the bare specifier onto that folder.

Do not add `nodeModulesPaths`, `blockList` or `resolveRequest` back unless a *new* version
skew is proven; `npx expo-doctor` is the check (it flags duplicate native modules).

### `apps/mobile/android/gradle.properties` — one hand edit

`android/` is generated and gitignored. Since the SDK upgrade exactly **one** line in it is a
hand edit that `expo prebuild` does not emit and **silently loses**:

- `gradle.properties` — `org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr`.
  Without it Gradle picks the system `java` (JDK 11) and fails.

`android/local.properties` (`sdk.dir=…`) is also wiped by prebuild and is *not* regenerated;
restore it too, or Gradle cannot find the Android SDK (no `ANDROID_HOME` is set on this
machine).

The old `settings.gradle` edit — `useExpoModules(exclude: ['expo-linking'])` — is **obsolete**
and must not be re-applied: SDK 57's `expo-linking` builds fine, and prebuild now emits
`expoAutolinking.useExpoModules()` with no exclusions.

**`expo prebuild` now clears `android/` even without `--clean`** (it does so whenever the
template version differs, which it will after any SDK bump). So: back the tree up first, run
`npx expo prebuild --platform android`, then diff and re-apply the two files above. Confirm
the regenerated `AndroidManifest.xml` still has `<data android:scheme="planner1440"/>` and
`android.permission.USE_EXACT_ALARM` — prebuild emits both from `app.json`, so hand-fixing
them (as pass 3 had to) should no longer be necessary.

### `app.json` changes reach `Constants.expoConfig` again (fixed upstream in SDK 57)

The JS side reads `scheme`, `plugins`, etc. from an `app.config` asset that the Gradle task
`:expo-constants:createExpoConfig` writes. Under expo-constants 16 that task declared an
output dir and **no inputs**, so Gradle reported it `UP-TO-DATE` forever and `app.json` edits
silently never reached JS — which is why pass 3's scheme rename changed the manifest but not
the app, and why the old advice was to delete the generated assets dir by hand.

expo-constants 57 fixes it: `node_modules/expo-constants/scripts/get-app-config-android.gradle`
now has `outputs.upToDateWhen { false }` plus a `doFirst` that wipes the assets dir, so the
task re-runs on every build. No manual deletion is needed. If an `app.json` change ever seems
not to land, the check is still the same — the Gradle log must show
`> Task :expo-constants:createExpoConfig` **without** `UP-TO-DATE`.

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
