# 1440 Planner — Wear OS watch face

Standalone Gradle project (not part of the Expo/React Native build) with two modules:

| Module | Package | What it is |
|---|---|---|
| `app/` | `com.planner1440.app` | **The code.** `DataLayerClient.kt` (Wearable Data Layer listener), `ComplicationHelper.kt` (four `SHORT_TEXT` complication data sources), and `WatchFaceService.kt` (an `androidx.wear.watchface` Canvas face). |
| `wff/` | `com.planner1440.wff` | **The face you actually see.** A no-code Watch Face Format v1 package (`res/raw/watchface.xml`) whose complication slots default to the data sources in `app/`. |

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
         → ComplicationDataSourceUpdateRequester.requestUpdateAll() for all four sources
         → in-process broadcast for the Canvas renderer (where one is allowed)
       CountUpComplicationService    → data only while countMode is "up"    (slot 1)
       CountDownComplicationService  → data only while countMode is "down"  (slot 3)
       NextBlockComplicationService  → "NOW Standup" / "till 3:30 PM"       (slot 2)
       MinuteCounterComplicationService → "542" / "MIN LEFT" — unused by our face, kept
                                          because it is the useful thing for someone
                                          else's face.
```

**What the face draws itself, from the watch clock:** the ring, the 96 ticks, the 24-hour
progress sweep, the minute hand, the wall clock, and the big minute figure. None of those
need the phone, so they stay correct while the phone app is closed. The phone supplies only
the count mode and the current/next block.

Per-block arcs are **not** on the WFF face: it has no way to draw N arbitrary arcs from a
JSON blob. See `docs/STATUS.md` for the plan.

## What this runtime will and will not do

Learned the hard way on the Galaxy Watch 7 (Wear OS 6), all of it silent — the runtime logs
no parse error, the element or value just does not appear:

- **`<DigitalClock>` / `<TimeText>` renders nothing.** Tried `hh:mm`, `h:mm a` and `HH:mm`,
  with and without `hourFormat`. Build clock strings from `<PartText>` + `<Template>` over
  `[HOUR_1_12]` / `[MINUTE]` instead; those work, as does `[AMPM_STATE]` (0 = AM, 1 = PM).
- **Complication data arrives as display strings only.** `[COMPLICATION.RANGED_VALUE]` and
  its `_MIN` / `_MAX` evaluate to `0` no matter what the source sends, at format version 1
  **and** 2. `[COMPLICATION.TEXT]` substitutes correctly with `%s` but is not coerced by
  arithmetic, so `[COMPLICATION.TEXT] * 2` is `0` too. There is therefore no way to compute
  or branch on a number the phone sent.
- **A `<Complication>` block does not render when its slot is EMPTY.** That is the one
  observable bit, and it is how the count-mode switch works: two slots in the same box whose
  data sources gate each other (`CountUp` / `CountDown`), each with its own colour and its
  own live expression.
- **Complication expressions are scoped to their own slot.** Nothing outside a
  `<ComplicationSlot>` can be styled from phone data, which is why the ring, ticks and hand
  stay amber in both count modes while the centre figure changes colour.
- `DefaultProviderPolicy` wants `primaryProviderType`, not `primaryProviderDefaultType`.
- Rotate a hand with a full-size `<Group pivotX="0.5" pivotY="0.5">` + `Transform angle`; a
  `Transform` on a narrow `PartDraw` does not render.

The runtime renumbers slots in its logs: our `slotId` 1, 3, 2 appear as `[11]`, `[12]`,
`[13]` in declaration order.

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
adb -s <watch> logcat -v time | Select-String '1440:DataLayer|1440:WatchFace|WearComplicationProvider'
```

Do not filter with `logcat -s 1440:DataLayer`: logcat reads the first colon as the
tag/priority separator (tag `1440`, priority `D`), so tags with a colon never match.
Capture unfiltered and grep. The lines to expect per snapshot are
`1440:DataLayer: Received snapshot, currentMinute=N`, then, as the face loads its slots,
one of `[11:NO_DATA]` / `[12:NO_DATA]` (the idle count mode) with the other showing
`[1x:TITLE] "MIN LEFT"` or `"MIN ELAPSED"`, plus `[13:TEXT] "NOW <title>"` /
`[13:TITLE] "till <time>"`. Seeing **both** `[11]` and `[12]` carry data means the gating
broke and two figures are stacked on screen.

Switching to another face and back re-queries both complications, which is the quickest
way to see a new snapshot if the phone is not around. Keep the watch on its charger with
*Stay awake while charging* on, or the Wi-Fi radio parks and the ADB session drops; off
the charger, `settings put system screen_off_timeout 1800000` (default `60000`) holds the
screen and the radio. A **locked** watch (`dumpsys trust` → `deviceLocked=1`, lock icon on
the face) renders both slots as `--` — the data is there, unlock it to see the values. See
`docs/STATUS.md` for the current state of the sync.
