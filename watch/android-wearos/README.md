# 1440 Planner — Wear OS watch face

Standalone Gradle project (not part of the Expo/React Native build) with two modules:

| Module | Package | What it is |
|---|---|---|
| `app/` | `com.planner1440.app` | **The code.** `DataLayerClient.kt` (Wearable Data Layer listener), `ComplicationHelper.kt` (two `SHORT_TEXT` complication data sources), and `WatchFaceService.kt` (an `androidx.wear.watchface` Canvas face). |
| `wff/` | `com.planner1440.wff` | **The face you actually see.** A no-code Watch Face Format v1 package (`res/raw/watchface.xml`) whose two complication slots default to the data sources in `app/`. |

Why two: **Wear OS 5+ launch devices refuse third-party androidx/Canvas faces.** On the
Galaxy Watch 7 (Wear OS 6) installing `app/` logs
`WearServices: [WatchFacesRestrictionManagerImpl] Watch face (…WatchFaceService) is blocked`
and the face never appears in the picker, while the complication data sources are accepted.
`WatchFaceService.kt` is kept for Wear OS 3/4 devices, but nothing depends on it.

## Data path

```
phone: syncToWatch() → modules/wearable-data-layer (PutDataMapRequest /1440/snapshot)
watch: DataLayerClient.onDataChanged
         → SharedPreferences 1440_watch/snapshot        (single persisted copy)
         → ComplicationDataSourceUpdateRequester.requestUpdateAll() for both sources
         → in-process broadcast for the Canvas renderer (where one is allowed)
       MinuteCounterComplicationService  → "542" / "MIN LEFT"   (watch clock + countMode)
       NextBlockComplicationService      → "Standup 3:30 PM"    (nextBlock from the snapshot)
       wff/watchface.xml slots 1 and 2 render those two.
```

Per-block arcs are **not** on the WFF face: WFF has no way to draw N arbitrary arcs from a
JSON blob. Ring, ticks, the 24-hour progress sweep, the minute hand and the clock are
computed from the watch clock in XML.

## Build

```powershell
cd watch/android-wearos
.\gradlew :app:assembleDebug :wff:assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk   (~12 MB)
# → wff/build/outputs/apk/debug/wff-debug.apk   (~40 KB)
```

Toolchain matches the phone build: Gradle 8.8 (wrapper committed), AGP 8.2.1, Kotlin
1.9.23, compileSdk/targetSdk 34 (`app/` minSdk 30, `wff/` minSdk 33 = WFF v1), JDK 17 via
`org.gradle.java.home` in `gradle.properties` (Android Studio's bundled JBR — edit that line
on another machine). `local.properties` (`sdk.dir=…`) is gitignored; create it or set
`ANDROID_HOME`.

`wff/src/main/res/raw/watchface.xml` and both modules' preview/icon PNGs are generated —
edit and rerun `tools/make-watchface.ps1` / `tools/make-preview.ps1`, don't hand-edit.

## Two things that must match the phone app

The Wearable Data Layer only routes data between the two halves of the *same* app:

1. **`app/`'s `applicationId` is `com.planner1440.app`**, the phone app's id. The Kotlin
   package / `namespace` stays `com.planner1440.watchface`.
2. **Same signing certificate.** `app/debug.keystore` is a copy of the React Native
   template debug keystore the phone build uses (`apps/mobile/android/app/debug.keystore`,
   SHA1 `5E:8F:16:06:…:F6:25`). `wff/` signs with it too. Change all three together when a
   release key exists.

## Install on the Galaxy Watch (Wi-Fi ADB)

The watch has no USB data path. Developer options → Wireless debugging, then:

```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
adb pair 192.168.1.68:<pair-port> <6-digit-code>     # once per pairing
adb connect 192.168.1.68:<connect-port>              # port shown on the main screen
adb -s 192.168.1.68:<port> install -r app\build\outputs\apk\debug\app-debug.apk
adb -s 192.168.1.68:<port> install -r wff\build\outputs\apk\debug\wff-debug.apk
```

**First time:** the face has to be added through the watch's own picker (long-press the
face → swipe to the last page → **+** → scroll to *Downloaded* → **1440 Planner**). The
`DEBUG_SURFACE` broadcast cannot add a face, only switch to one that is already a favourite.

**After that:**

```powershell
adb -s <watch> shell am broadcast -a com.google.android.wearable.app.DEBUG_SURFACE --es operation set-watchface --es watchFaceId com.planner1440.wff
adb -s <watch> logcat -s 1440:DataLayer 1440:WatchFace DWF:WearComplicationProvider
```

Switching to another face and back re-queries both complications, which is the quickest
way to see a new snapshot if the phone is not around. Keep the watch on its charger with
*Stay awake while charging* on, or the Wi-Fi radio parks and the ADB session drops. See
`docs/STATUS.md` for the current state of the sync.
