# 1440 Planner

> Every day is 1440 minutes. Plan yours.

A productivity calendar that operates in minute-time (0–1440) instead of
conventional clock hours. Features a paired watch face for Android Wear OS
and Apple Watch.

## Quick Start

> **Do not run `expo` from the repo root.** The root is an npm-workspaces manifest, not an
> Expo project — it has no `metro.config.js`, no `babel.config.js` and no entry point.
> The app lives in `apps/mobile`.

### Prerequisites

- **Node 20** and **npm 10** (developed on Node v20.20.0 / npm 10.8.2)
- **Android Studio** with the Android SDK, for on-device builds
- An Android phone with **USB debugging** enabled
  (Settings → About phone → tap *Build number* 7×, then Developer options → USB debugging)

You do **not** need to install or configure a JDK. Gradle is pinned to Android Studio's
bundled JDK 17 via `org.gradle.java.home` in `apps/mobile/android/gradle.properties`, so
whatever `java` is on your `PATH` is irrelevant to the build.

### Run on an Android device

```bash
npm install

# Plug the phone in over USB and confirm it is visible:
#   adb devices      → should list your device as "device"

cd apps/mobile
npx expo run:android
```

This builds and installs the debug app (`com.planner1440.app`), starts Metro, and connects
the device automatically. Subsequent runs reuse the Gradle cache and are much faster.

Once the app is installed, you can start just the bundler from the repo root:

```bash
npm run mobile     # → expo start, in apps/mobile
```

### Expo Go is not supported

This app is pinned to **Expo SDK 51** (May 2024). The Expo Go builds on the App Store and
Play Store only support the *current* SDK, so scanning a QR code with a modern Expo Go
fails with an incompatible-SDK error. Use the dev build above.

iOS is not currently buildable: there is no `ios/` directory, no `eas.json`, and no EAS
project configured. See `docs/STATUS.md`.

## Project Status

See `docs/STATUS.md` — what works, what is scaffolded but not wired, and what's next.

## Project Layout

See `docs/REPO_STRUCTURE.md` for the full annotated directory tree.

## Roadmap

See `docs/WATCH_FACE_ROADMAP.md`.

## Design Tokens

See `docs/DESIGN_TOKENS.md`.

## Claude Code Handoff

See `docs/CLAUDE_CODE_HANDOFF.md`, and `CLAUDE.md` for working conventions.
