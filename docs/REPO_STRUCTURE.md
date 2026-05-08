# 1440 Planner — Repo Structure

```
1440-planner/                          ← monorepo root
│
├── package.json                       ← npm workspaces (packages/* + apps/*)
├── .gitignore
├── .env.example                       ← copy to .env, fill in Supabase keys
├── README.md
│
├── docs/
│   ├── REPO_STRUCTURE.md              ← this file
│   ├── CLAUDE_CODE_HANDOFF.md         ← full prompt for Claude Code
│   ├── WATCH_FACE_ROADMAP.md          ← Android + Apple Watch plan
│   ├── API_SPEC.md                    ← Supabase REST + realtime schema
│   └── DESIGN_TOKENS.md              ← colors, typography, spacing
│
│
├── packages/
│   └── core/                          ← @1440/core — shared, framework-agnostic
│       ├── package.json
│       └── src/
│           ├── index.ts               ← barrel export
│           ├── types/
│           │   ├── event.ts           ← CalendarEvent, CategoryId
│           │   ├── todo.ts            ← Todo, Priority
│           │   └── repeat.ts         ← RepeatMode, RepeatConfig
│           ├── utils/
│           │   ├── time.ts            ← minuteToTimeStr, clockToMinute, etc.
│           │   ├── dateHelpers.ts     ← today(), dateAddDays(), formatDateDisplay()
│           │   └── schedule.ts        ← findNextFreeSlot, autoScheduleQueue,
│           │                          │   expandRepeat
│           ├── store/
│           │   ├── useCalendarStore.ts ← Zustand: events CRUD + series logic
│           │   ├── useTodoStore.ts    ← Zustand: todos + link/unlink events
│           │   └── useSettingsStore.ts ← countMode, bufferMinutes, selectedDate
│           └── hooks/
│               └── useCurrentMinute.ts ← 30-second polling hook
│
│
├── apps/
│   ├── web/                           ← @1440/web — Vite React prototype
│   │   ├── package.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.jsx
│   │       └── App.jsx               ← ← ← PASTE 1440-calendar.jsx HERE
│   │
│   └── mobile/                        ← @1440/mobile — Expo React Native (primary)
│       ├── package.json
│       ├── app.json                   ← Expo config
│       ├── assets/
│       │   ├── icon.png
│       │   ├── splash.png
│       │   └── adaptive-icon.png
│       └── src/
│           ├── app/                   ← Expo Router file-based routes
│           │   ├── _layout.tsx        ← root layout, theme provider
│           │   ├── index.tsx          ← redirect → /day
│           │   ├── day.tsx            ← main timeline screen
│           │   ├── watch.tsx          ← full-screen watch face
│           │   ├── tasks.tsx          ← task backlog
│           │   └── settings.tsx       ← count mode, buffer, notifications
│           │
│           ├── components/
│           │   ├── calendar/
│           │   │   ├── DayGrid.tsx         ← scrollable 1440-min timeline
│           │   │   ├── EventBlock.tsx      ← tap-to-edit colored block
│           │   │   ├── DateStrip.tsx       ← 7-day horizontal date nav
│           │   │   └── TimelineRuler.tsx   ← hour + 15-min tick labels
│           │   │
│           │   ├── watchface/
│           │   │   ├── WatchCanvas.tsx     ← SVG watch face (react-native-svg)
│           │   │   ├── MinuteHand.tsx      ← animated 1440-position hand
│           │   │   ├── EventArcs.tsx       ← per-event colored arc segments
│           │   │   └── CounterDisplay.tsx  ← center minute counter text
│           │   │
│           │   ├── tasks/
│           │   │   ├── TodoRow.tsx         ← single task with AUTO/PICK actions
│           │   │   └── TaskBacklog.tsx     ← full task list + add form
│           │   │
│           │   └── ui/                    ← reusable primitives
│           │       ├── MinuteInput.tsx    ← dual minute/clock entry (toggle)
│           │       ├── CategoryPicker.tsx ← 2-col category grid
│           │       ├── BlockModal.tsx     ← new/edit event bottom sheet
│           │       └── RepeatPicker.tsx   ← none/daily/weekly/custom
│           │
│           ├── navigation/
│           │   └── RootNavigator.tsx      ← tab bar config
│           │
│           └── services/
│               ├── notifications.ts       ← expo-notifications helpers
│               ├── storage.ts             ← AsyncStorage wrappers
│               └── watchSync.ts          ← platform-branched watch bridge
│
│
├── watch/
│   ├── android-wearos/               ← Wear OS watch face module
│   │   ├── README.md
│   │   └── app/src/main/
│   │       ├── java/com/planner1440/watchface/
│   │       │   ├── WatchFaceService.kt        ← main service + canvas rendering
│   │       │   ├── ComplicationHelper.kt      ← next block + progress data
│   │       │   └── DataLayerClient.kt         ← Wearable Data Layer listener
│   │       └── res/
│   │           ├── raw/watchface.xml          ← Watch Face Format XML
│   │           ├── xml/watch_face_info.xml    ← metadata
│   │           └── drawable/                  ← hand + background assets
│   │
│   └── apple-watchos/               ← watchOS complication + widget
│       ├── README.md
│       └── 1440WatchFace/Sources/
│           ├── WatchFaceView.swift            ← SwiftUI complication views
│           ├── ComplicationController.swift   ← ClockKit timeline provider
│           ├── WatchConnectivityManager.swift ← WCSession delegate
│           └── MinuteProgressView.swift       ← reusable arc progress view
│
│
└── backend/
    └── supabase/
        ├── functions/
        │   └── sync-events/
        │       └── index.ts           ← edge function: merge device snapshots
        ├── migrations/
        │   └── 001_initial_schema.sql ← events, todos, settings tables
        └── seed/
            └── sample_data.sql        ← dev seed data
```

---

## Dependency Graph

```
packages/core
    ↑           ↑
apps/web    apps/mobile
                ↑
         watch/android-wearos  (via Data Layer, not npm)
         watch/apple-watchos   (via WatchConnectivity, not npm)
```

`packages/core` has zero native or UI dependencies — it can be unit tested
with plain Node. Both app targets import it via npm workspaces (`@1440/core`).
The watch packages are separate native projects that communicate with the
mobile app at runtime, not at build time.

---

## Technology Choices Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| Monorepo | npm workspaces | Zero config, native to npm, no Turborepo overhead for this size |
| Mobile | Expo (managed) | Fastest path to both iOS + Android; OTA updates; push notifications built in |
| Navigation | Expo Router | File-based, works with deep links and notifications |
| State | Zustand | Tiny, no boilerplate, works identically on web + RN |
| Persistence | AsyncStorage | Expo-compatible, no native setup required |
| Watch format | WFF (XML) | Google's required format for new Wear OS face submissions |
| iOS watch | ClockKit + WidgetKit | Only option Apple allows for watch face presence |
| Cloud sync | Supabase | Row-level security, realtime, offline-first via client library |
| SVG | react-native-svg | 1:1 with web SVG — watch face canvas ports cleanly |
