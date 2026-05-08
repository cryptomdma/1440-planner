# 1440 Planner — Watch Face Roadmap

> One face. 1,440 minutes. The whole day at a glance.

---

## The Vision

The watch face IS the product differentiator. While the phone app handles
scheduling, the watch face is what people see 40–60 times a day. It should
communicate at a glance:

- How many minutes of the day remain (or have elapsed)
- What block is happening right now
- What's coming next
- The colored arc map of the whole day's schedule

---

## Platform Overview

| Platform | Framework | Distribution | Custom Faces Allowed? |
|----------|-----------|-------------|----------------------|
| **Wear OS 3+** (Samsung, Google Pixel Watch) | Watch Face Format (XML) or Canvas API (Kotlin) | Google Play Store | ✅ Yes — full custom faces |
| **Wear OS 2** (older devices) | Canvas WatchFaceService (Kotlin) | Google Play Store | ✅ Yes |
| **Apple Watch** (watchOS 7+) | ClockKit Complications only | App Store (as complication, not full face) | ⚠️ Partial — Apple does NOT allow third-party full watch faces. Only complications. |
| **Apple Watch** (watchOS 10+) | WidgetKit Smart Stack | App Store | ✅ Widgets on watch (not face) |
| **Galaxy Watch** (Tizen legacy) | Galaxy Watch Studio | Galaxy Store | ✅ Yes |

> **Bottom line:** Android/Wear OS gets a full custom face. Apple Watch gets a
> complication + widget — still highly useful, just not a "blank canvas" face.

---

## Phase 1 — Wear OS (Android) Full Watch Face

### Technology Choice: Watch Face Format (WFF)

Google's **Watch Face Format** (introduced Wear OS 3.5, required for new
submissions 2025+) is an XML-based declarative format. It's the right choice
because:

- No Kotlin required for the face itself (pure XML + assets)
- Supports complications natively
- Handles always-on display (AOD) automatically
- Validator tool available in Android Studio

**Fallback:** If WFF can't express something (e.g., the custom minute-arc math),
use `CanvasWatchFaceService` (Kotlin coroutine-based) instead.

### Watch Face Elements

```
┌─────────────────────────┐
│   ┌───────────────────┐ │
│   │  Outer ring:      │ │  ← 96 tick marks (one per 15 min)
│   │  Colored arcs     │ │  ← scheduled blocks as category-colored arcs
│   │  Progress arc     │ │  ← amber (up) or cyan (down) sweep
│   │                   │ │
│   │    ┌─────────┐    │ │
│   │    │  0847   │    │ │  ← large minute counter (center)
│   │    │ elapsed │    │ │  ← mode label
│   │    │  8:47AM │    │ │  ← clock time
│   │    └─────────┘    │ │
│   │                   │ │
│   │  Minute hand →    │ │  ← single hand, 1440-position sweep
│   └───────────────────┘ │
│  [COMP1]      [COMP2]   │  ← complications (next block / steps / battery)
└─────────────────────────┘
```

### File: `watch/android-wearos/app/src/main/res/raw/watchface.xml`

Key WFF elements to implement:

```xml
<WatchFace>
  <!-- Background -->
  <Scene backgroundColor="#07090f">

    <!-- Tick ring: 96 positions, major every 4 = 24 hour markers -->
    <PartDraw x="0" y="0" width="450" height="450">
      <Transform target="SECONDS_TOTAL" ... />
    </PartDraw>

    <!-- Event arcs: one per scheduled event, driven by complication data -->
    <!-- Color maps to category via UserStyleSetting (color scheme) -->

    <!-- Progress sweep arc -->
    <Arc centerX="225" centerY="225" width="340" height="340"
         startAngle="-90" sweepAngle="{{MINUTE_OF_DAY / 1440 * 360}}">
      <Stroke color="#F59E0B" thickness="6" cap="ROUND"/>
    </Arc>

    <!-- Minute hand: full 1440-position (not 60) -->
    <!-- WFF doesn't have a built-in 1440 hand — use PartRotate with -->
    <!-- expression: MINUTE_OF_DAY / 1440 * 360 -->
    <PartRotate pivotX="225" pivotY="225"
                angle="{{MINUTE_OF_DAY / 1440 * 360 - 90}}">
      <PartDraw .../>  <!-- hand shape -->
    </PartRotate>

    <!-- Center counter -->
    <PartText x="185" y="210" width="130" height="50"
              text="{{MINUTE_OF_DAY}}" align="CENTER"
              font="monospace" size="36" color="#F59E0B"/>

    <!-- Complications -->
    <Complication slotId="BOTTOM_PRIMARY" x="112" y="370"/>
    <Complication slotId="BOTTOM_SECONDARY" x="280" y="370"/>

  </Scene>

  <!-- Always-On Display (simplified) -->
  <Scene backgroundColor="#000000" mode="AMBIENT">
    <!-- Simplified: just progress arc + minute number, no color -->
  </Scene>
</WatchFace>
```

> **Note:** WFF expressions use a subset of math. For `MINUTE_OF_DAY`, use
> `HOUR * 60 + MINUTE` as the computed value source.

### Data Sync: Phone → Watch

Use **Wearable Data Layer API** (`DataClient`):

```kotlin
// DataLayerClient.kt (phone side, called from React Native via JSI or module)
val putDataRequest = PutDataMapRequest.create("/1440/snapshot").apply {
    dataMap.putString("events_json", eventsJson)      // today's events
    dataMap.putInt("current_minute", currentMinute)
    dataMap.putString("count_mode", countMode)        // "up" or "down"
    dataMap.putLong("updated_at", System.currentTimeMillis())
}
Wearable.getDataClient(context).putDataItem(putDataRequest.asPutDataRequest())
```

```kotlin
// WatchFaceService.kt (watch side) — listen for data
override fun onDataChanged(dataEvents: DataEventBuffer) {
    dataEvents.forEach { event ->
        if (event.dataItem.uri.path == "/1440/snapshot") {
            val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
            // parse events_json, update complications
        }
    }
}
```

**Sync triggers:**
- On app foreground
- On event create/edit/delete
- Every 15 minutes via `WorkManager`

### React Native Bridge

The phone app calls watch sync via a native module:

```ts
// apps/mobile/src/services/watchSync.ts
import { NativeModules } from 'react-native';
const { WearOSSyncModule } = NativeModules;

export const sendDaySnapshot = async (events, currentMinute) => {
  if (!WearOSSyncModule) return; // not available on iOS
  await WearOSSyncModule.sendSnapshot(JSON.stringify(events), currentMinute);
};
```

Create `WearOSSyncModule` as a standard React Native native module in
`apps/mobile/android/app/src/main/java/com/planner1440/`.

### Complications

Two complication slots on the watch face:

| Slot | Default data source | Type |
|------|--------------------|----|
| BOTTOM_PRIMARY | Next block title + start minute | `SHORT_TEXT` |
| BOTTOM_SECONDARY | Minutes remaining in current block | `RANGED_VALUE` |

Register complication data sources in `WatchFaceService.kt`:

```kotlin
override fun getComplicationSupportedTypes(complicationId: Int) =
    when (complicationId) {
        NEXT_BLOCK_COMPLICATION_ID -> intArrayOf(ComplicationData.TYPE_SHORT_TEXT)
        CURRENT_BLOCK_COMPLICATION_ID -> intArrayOf(ComplicationData.TYPE_RANGED_VALUE)
        else -> intArrayOf()
    }
```

### Distribution

1. Create a separate Android module: `watch/android-wearos/`
2. Pair it as a **wearable feature module** of the main phone APK
3. Google Play automatically installs the watch app when the phone app installs
4. Submit both as a single Play Store listing

---

## Phase 2 — Apple Watch Complication + Widget

### What's Possible on Apple Watch

Apple does **not** allow third-party full watch faces. What IS allowed:

| Feature | watchOS | API | Placement |
|---------|---------|-----|-----------|
| **Complication** | 7+ | ClockKit | Modular, Infograph face, etc. |
| **Widget** | 10+ | WidgetKit | Smart Stack (swipe up from face) |
| **App** | All | SwiftUI | Accessible from Crown spin or app grid |

**Strategy:** Build a rich complication + widget that surfaces the 1440 counter
directly on the user's preferred watch face.

### Complication: 1440 Counter (`watch/apple-watchos/`)

```swift
// ComplicationController.swift
struct MinuteCounterEntry: TimelineEntry {
    let date: Date
    let minuteElapsed: Int
    let minuteRemaining: Int
    let countMode: CountMode        // .up or .down
    let currentBlockTitle: String?
    let nextBlockTitle: String?
    let nextBlockMinute: Int?
}

struct MinuteCounterComplicationView: View {
    var entry: MinuteCounterEntry

    var body: some View {
        // Infograph Modular: large arc + number
        // Modular Small: just the number
        // Circular Small: arc only
        switch complicationFamily {
        case .graphicCorner:
            GraphicCornerView(entry: entry)
        case .graphicCircular:
            GraphicCircularView(entry: entry)
        default:
            Text("\(entry.displayNumber)")
        }
    }

    var displayNumber: Int {
        entry.countMode == .down ? entry.minuteRemaining : entry.minuteElapsed
    }
}
```

**Complication families to support:**

| Family | Layout | Content |
|--------|--------|---------|
| `.graphicCorner` | Arc + text | Progress arc + minute number |
| `.graphicCircular` | Circle | Mini watch face arc |
| `.graphicRectangular` | Wide bar | Current block + next block |
| `.modularSmall` | Square | Just the minute number |
| `.utilitarianSmall` | Tiny | Short text: "847m" |

### WidgetKit Watch Widget (watchOS 10+)

```swift
// 1440Widget.swift
struct MinuteWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.1440.planner.widget") { entry in
            MinuteWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("1440 Planner")
        .description("Your day in minutes.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
```

### WatchConnectivity (Phone ↔ Watch)

```swift
// WatchConnectivityManager.swift
import WatchConnectivity

class WatchConnectivityManager: NSObject, WCSessionDelegate {
    func sendSnapshot(_ events: [[String: Any]], currentMinute: Int) {
        guard WCSession.isSupported(), WCSession.default.isReachable else { return }
        WCSession.default.sendMessage([
            "events": events,
            "currentMinute": currentMinute,
            "countMode": UserDefaults.standard.string(forKey: "countMode") ?? "up"
        ], replyHandler: nil)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        // Update complication timeline
        CLKComplicationServer.sharedInstance().reloadTimeline(for: complication)
    }
}
```

### React Native → Swift Bridge

```ts
// apps/mobile/src/services/watchSync.ts
import { NativeModules, Platform } from 'react-native';

export const sendDaySnapshot = async (events, currentMinute) => {
  if (Platform.OS === 'ios') {
    const { WatchConnectivityModule } = NativeModules;
    if (WatchConnectivityModule) {
      await WatchConnectivityModule.sendSnapshot(JSON.stringify(events), currentMinute);
    }
  } else if (Platform.OS === 'android') {
    const { WearOSSyncModule } = NativeModules;
    if (WearOSSyncModule) {
      await WearOSSyncModule.sendSnapshot(JSON.stringify(events), currentMinute);
    }
  }
};
```

### Distribution

- The watchOS extension is bundled inside the iOS app target
- Single App Store submission
- Watch app installs automatically when iOS app installs

---

## Phase 3 — Complication Data Architecture

Both platforms need the same data contract:

```ts
// packages/core/src/types/watchSnapshot.ts
export interface WatchSnapshot {
  version: 1;
  date: string;                    // "YYYY-MM-DD"
  currentMinute: number;           // 0–1439
  countMode: "up" | "down";
  events: WatchEvent[];
  currentBlock: WatchEvent | null;
  nextBlock: WatchEvent | null;
}

export interface WatchEvent {
  startMinute: number;
  duration: number;
  title: string;
  category: string;
  color: string;                   // hex, resolved from category
}
```

---

## Full Roadmap Timeline

### ✅ Done
- Web prototype (React, all features functional)

### 🔨 Now — Mobile App (Est. 4–6 weeks)
- [ ] Scaffold Expo project
- [ ] Port prototype to React Native
- [ ] Zustand + AsyncStorage persistence
- [ ] Local notifications
- [ ] TestFlight + internal Play Store track

### 📡 Next — Watch Sync (Est. 3–4 weeks after mobile)
- [ ] Wear OS native module (React Native bridge)
- [ ] WFF watch face XML (basic: arc + counter + hand)
- [ ] Wear OS complication data provider
- [ ] watchOS complication (`.graphicCircular` + `.graphicRectangular`)
- [ ] WatchConnectivity iOS bridge

### 🎨 Then — Watch Face Polish (Est. 2–3 weeks)
- [ ] Full Wear OS event arc rendering (per-category colors from complication)
- [ ] AOD (always-on) simplified mode
- [ ] Watch face configuration (color scheme, count mode) via companion settings
- [ ] Apple Watch Widget (watchOS 10 WidgetKit)
- [ ] Wear OS: block creation from watch (dictation or emoji picker for title)

### 🚀 Future
- [ ] Wear OS tile (glanceable daily summary)
- [ ] Apple Watch app (full app, not just complication — browse tomorrow's blocks)
- [ ] Galaxy Watch (Tizen) via Samsung Watch Face Studio
- [ ] Light mode
- [ ] Shared calendars / team view
- [ ] AI suggestion: "You have 90 free minutes at 2 PM — want to schedule Deep Work?"
- [ ] Supabase cloud sync
- [ ] Google Calendar import/export
- [ ] Apple Calendar / iCal integration

---

## Resources

### Wear OS
- [Watch Face Format developer guide](https://developer.android.com/training/wearables/wff)
- [Wearable Data Layer API](https://developer.android.com/training/wearables/data/data-layer)
- [WFF Validator (Android Studio plugin)](https://developer.android.com/training/wearables/wff/validator)
- [Wear OS Complication API](https://developer.android.com/training/wearables/complications)

### Apple Watch
- [ClockKit documentation](https://developer.apple.com/documentation/clockkit)
- [WidgetKit for watchOS](https://developer.apple.com/documentation/widgetkit/creating-accessory-widgets-and-watch-complications)
- [WatchConnectivity framework](https://developer.apple.com/documentation/watchconnectivity)
- [Human Interface Guidelines — Complications](https://developer.apple.com/design/human-interface-guidelines/complications)

### React Native Bridges
- [Native Modules (Android)](https://reactnative.dev/docs/native-modules-android)
- [Native Modules (iOS)](https://reactnative.dev/docs/native-modules-ios)
- [`react-native-watch-connectivity`](https://github.com/mtford90/react-native-watch-connectivity) — community WatchConnectivity bridge

---

## Key Insight: The Watch Face IS the Brand

Most productivity apps are background tools. 1440 Planner's watch face makes
the time-budget philosophy **visible 50+ times a day** — the sweep arc shrinking
toward zero, the amber hand tracking your minute through the dial.

That ambient, always-on presence is the product's unfair advantage. Build the
mobile app well. Build the watch face brilliantly.
