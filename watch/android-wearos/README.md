# 1440 Planner — Wear OS watch face

Standalone Gradle project (not part of the Expo/React Native build) with two modules:

| Module | Package | What it is |
|---|---|---|
| `app/` | `com.planner1440.app` | **The code.** `DataLayerClient.kt` (Wearable Data Layer listener), `ComplicationHelper.kt` (four `SHORT_TEXT` complication data sources), `BlockArcsComplicationService.kt` (paints today's blocks as arcs into a full-face `SMALL_IMAGE`), and `WatchFaceService.kt` (an `androidx.wear.watchface` Canvas face). |
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
         → ComplicationDataSourceUpdateRequester.requestUpdateAll() for all five sources
         → in-process broadcast for the Canvas renderer (where one is allowed)
       BlockArcsComplicationService  → 450x450 bitmap: ring + ticks in the count-mode
                                       colour, a thin arc per category range, one
                                       arc per block                              (slot 4)
       CountUpComplicationService    → data only while countMode is "up"    (slot 1)
       CountDownComplicationService  → data only while countMode is "down"  (slot 3)
       NextBlockComplicationService  → "NOW Standup" / "till 3:30 PM"       (slot 2)
       MinuteCounterComplicationService → "542" / "MIN LEFT" — unused by our face, kept
                                          because it is the useful thing for someone
                                          else's face.
```

**What the face draws itself, from the watch clock:** the 24-hour progress sweep, the
minute hand, the wall clock, and the big minute figure. None of those need the phone, so
they stay correct while the phone app is closed. The phone supplies the count mode, the
current/next block, the block list the arcs are drawn from and the category time ranges.

**The arcs bitmap** (passes 12a and 12): WFF has no loop, so the face cannot draw N arcs
from the snapshot itself. Instead `BlockArcsComplicationService` runs the `Canvas` loops on
the watch over the JSON already in `SharedPreferences` and hands the runtime a 450×450
`ARGB_8888` bitmap as a `SMALL_IMAGE` (`SmallImageType.PHOTO`); the face shows it through
`slotId="4"`, a full-face `isCustomizable="FALSE"` slot emitted first in the `<Scene>`, so
the sweep and hand draw over it. It paints, in order: the outer ring circle and the 96
ticks in the count-mode colour (amber up, cyan down — they used to be WFF `<PartDraw>`s
and were stuck amber), one thin arc per category time range (`ranges` in the snapshot) on
that ring, and one thicker arc per block at the block radius. With no snapshot at all
(fresh install) it still returns ring and ticks in amber; with a snapshot whose `date` is
not the watch's local today it returns ring and ticks only, so yesterday's blocks never
sit on the face past midnight. Probe result on the Galaxy Watch 7: `SMALL_IMAGE`/PHOTO
renders **untinted and at exact scale** (pure red/green/blue sampled off the screen);
`PHOTO_IMAGE` is refused by WearServices (`ComplicationPackageChecker: Unexpected
complication data type PHOTO_IMAGE`) and the slot stays NOT_CONFIGURED. The bitmap is
redrawn only when a snapshot arrives (`requestUpdateAll()`) or the face reloads, so
anything that must move by itself (hand, sweep, figure) stays in WFF.

## What this runtime will and will not do

Learned the hard way on the Galaxy Watch 7 (Wear OS 6), all of it silent — the runtime logs
no parse error, the element or value just does not appear:

- **`<DigitalClock>` / `<TimeText>` renders nothing.** Tried `hh:mm`, `h:mm a` and `HH:mm`,
  with and without `hourFormat`. Build clock strings from `<PartText>` + `<Template>` over
  `[HOUR_0_23]` / `[HOUR_1_12]` / `[MINUTE]` instead; those work, as does `[AMPM_STATE]`.
- **Complication data arrives as display strings only.** `[COMPLICATION.RANGED_VALUE]` and
  its `_MIN` / `_MAX` evaluate to `0` no matter what the source sends, at format version 1
  **and** 2. `[COMPLICATION.TEXT]` substitutes correctly with `%s` but is not coerced by
  arithmetic, so `[COMPLICATION.TEXT] * 2` is `0` too. There is therefore no way to compute
  or branch on a number the phone sent.
- **A `<Complication>` block does not render when its slot is EMPTY.** That is the one
  observable bit, and it is how the count-mode switch works: two slots in the same box whose
  data sources gate each other (`CountUp` / `CountDown`), each with its own colour and its
  own live expression. **The idle gate must return `NoDataComplicationData()`, not `null`:**
  null means "no change" to the system, the slot keeps whatever it showed last, and after
  the first flip both figures sit on screen at once. (Shipped that way for an evening.)
- **The clock is 24-hour** (`%02d:%02d` over `[HOUR_0_23]`/`[MINUTE]`). A 12/24 setting is
  scheduled; if it is a *phone* setting it cannot reach the clock element directly and needs
  either the same slot-gating trick or a WFF `UserConfiguration` on the watch. For 12-hour,
  `[HOUR_1_12]` and `[AMPM_STATE]` (0 = AM, 1 = PM) are verified to resolve.
- **Complication expressions are scoped to their own slot.** Nothing outside a
  `<ComplicationSlot>` can be styled from phone data, which is why the hand and sweep stay
  amber in both count modes while the centre figure changes colour. The ring and ticks
  escaped this in pass 12 by moving into the full-face arcs bitmap, where the watch app
  colours them; the hand and sweep cannot follow, because that bitmap only refreshes on a
  snapshot push.
- **Image slots:** a full-face `SMALL_IMAGE` slot shows a `SmallImageType.PHOTO` bitmap
  untinted and unscaled; `PHOTO_IMAGE` sources are rejected by WearServices on this device.
- `DefaultProviderPolicy` wants `primaryProviderType`, not `primaryProviderDefaultType`.
- Rotate a hand with a full-size `<Group pivotX="0.5" pivotY="0.5">` + `Transform angle`; a
  `Transform` on a narrow `PartDraw` does not render.

The runtime renumbers slots in its logs in declaration order: our `slotId` 4, 1, 3, 2
appear as `[11:SMALL_IMAGE]`, `[12]`, `[13]`, `[14]`.

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
