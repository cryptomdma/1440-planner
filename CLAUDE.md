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
- Leave a handoff note proposing the next pass, with enough detail that a fresh session can
  act on it without re-deriving context.
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

### `apps/mobile/android/settings.gradle`

Contains `useExpoModules(exclude: ['expo-linking'])` — the `expo-linking` native module is
deliberately excluded to dodge an `expo-module-gradle-plugin` incompatibility. This is why
`metro.config.js` must redirect `expo-linking` to a pure-JS version.

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
- No test framework is configured, and there is no `check`/`lint` script. Verify changes by
  running the app on a device.
