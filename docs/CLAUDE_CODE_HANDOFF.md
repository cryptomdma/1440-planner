# 1440 Planner — Claude Code Handoff Prompt
> Copy everything below the horizontal rule into a Claude Code session.
> Prerequisites: run `scaffold.sh`, then copy `1440-calendar-v6.jsx` → `apps/web/src/App.jsx`.

---

## Project Brief

You are building the production mobile app for **1440 Planner** — a productivity
calendar that measures time in **minutes (0–1440)** instead of clock hours.
Every day is exactly 1,440 minutes. Treat them like a budget.

The fully-functional React web prototype lives at `apps/web/src/App.jsx`
(source file: `1440-calendar-v6.jsx`). It is the **single source of truth**
for all business logic, UX patterns, and data structures.

Your three jobs:
1. Extract shared logic into `packages/core`
2. Build the Expo React Native app in `apps/mobile` — faithful port, no redesign
3. Wire persistence, notifications, and watch sync stubs

---

## Repo Layout

```
1440-planner/
├── packages/core/          ← shared types, store, utils (framework-agnostic TS)
├── apps/web/               ← React prototype (Vite) — source of truth
├── apps/mobile/            ← Expo React Native — primary build target
├── watch/
│   ├── android-wearos/     ← Kotlin / Watch Face Format XML
│   └── apple-watchos/      ← Swift / SwiftUI + ClockKit
├── backend/supabase/       ← optional cloud sync
└── docs/
```

---

## What the Prototype Already Does (v6)

Before writing any code, read `apps/web/src/App.jsx` in full. These features
are **complete** in the prototype and must be ported exactly:

| Feature | Status | Notes |
|---------|--------|-------|
| 1440-minute day grid | ✅ Done | Scrollable timeline, PPM=2.8 px/min |
| Count-up / count-down mode | ✅ Done | Amber (#F59E0B) vs cyan (#38BDF8), affects all labels |
| 7-day date strip + navigation | ✅ Done | Horizontal scroll, dot indicators, TODAY shortcut |
| Day summary bar | ✅ Done | % scheduled vs active window, conflict count |
| Wake/sleep window shading | ✅ Done | Darkens grid outside wakeMinute–sleepMinute range |
| Event blocks with overlap layout | ✅ Done | `computeLayout()` — side-by-side columns, not z-stacked |
| Event create modal | ✅ Done | Title, date, start (MinuteInput), duration, category, repeat |
| Repeat scheduling | ✅ Done | None / Daily / Weekly / Custom (n days × count) |
| Editable event side panel | ✅ Done | Title, category, date, start, duration — all live-edit |
| Undo delete toast | ✅ Done | 4-second timer, restores event + todo link |
| Watch face view | ✅ Done | SVG circular dial, event arcs, progress sweep, minute hand |
| Task backlog | ✅ Done | Pending / On Calendar / Done sections |
| Task AUTO scheduling | ✅ Done | Next free slot, respects `bufferMinutes` setting |
| Task PICK → placement panel | ✅ Done | Switches to calendar view, opens `TodoPlacementPanel` in sidebar |
| AUTO-SCHEDULE ALL | ✅ Done | Priority-sorted, buffer-spaced, switches to calendar view |
| `MinuteInput` dual entry | ✅ Done | Toggle between 0–1440 number and H:MM AM/PM clock |
| Settings panel | ✅ Done | Default duration, buffer, wake/sleep window, conflict highlight |
| Mobile-optimized header | ✅ Done | 2-row compact layout, no wrapping |

---

## Phase 1 — Core Package (`packages/core`)

Extract into **pure TypeScript** — zero React, zero React Native imports.

### Types (`src/types/`)

```ts
// event.ts
export interface CalendarEvent {
  id: string | number;
  date: string;           // ISO "YYYY-MM-DD"
  startMinute: number;    // 0–1439
  duration: number;       // minutes, should be multiple of 15
  title: string;
  category: CategoryId;
  fromTodo?: boolean;     // placed from task backlog
  seriesId?: string;      // links repeat instances
}

export type CategoryId = "deep" | "meeting" | "admin" | "break" | "personal";

export interface EventLayoutSlot {
  column: number;         // 0-indexed column in overlap group
  totalColumns: number;   // width = 1/totalColumns of available space
}

// todo.ts
export interface Todo {
  id: string | number;
  title: string;
  duration: number;
  category: CategoryId;
  priority: Priority;
  done: boolean;
  scheduledEventId: string | number | null;
}

export type Priority = "high" | "med" | "low";

// repeat.ts
export type RepeatMode = "none" | "daily" | "weekly" | "custom";
export interface RepeatConfig {
  mode: RepeatMode;
  intervalDays: number;   // 1=daily, 7=weekly, n=custom
  count: number;          // total occurrences (2–52)
}

// settings.ts
export interface AppSettings {
  countMode:          "up" | "down";
  defaultDuration:    number;          // minutes, default 60
  bufferMinutes:      number;          // auto-schedule gap, default 15
  wakeMinute:         number;          // default 360 (6 AM)
  sleepMinute:        number;          // default 1320 (10 PM)
  highlightConflicts: boolean;
  selectedDate:       string;          // ISO "YYYY-MM-DD"
}

// edit scope — for series editing (Phase 2 polish)
export type EditScope = "instance" | "this_and_future" | "all";
```

### Utils (`src/utils/`)

Port these functions verbatim from the prototype:

**`time.ts`**
```ts
minuteToTimeStr(m: number): string        // 481 → "8:01 AM"
getCurrentMinute(): number                // live: hours*60 + minutes
clockToMinute(h: string, m: string, ap: string): number
minuteToClock(m: number): { h: string, m: string, ap: string }
```

**`dateHelpers.ts`**
```ts
today(): string                           // "YYYY-MM-DD"
dateAddDays(date: string, n: number): string
formatDateDisplay(date: string): string   // "Mon, Apr 21"
isToday(date: string): boolean
```

**`schedule.ts`**
```ts
// Find first free slot of `duration` mins at or after `startAfter`.
// Caller pre-pads events with buffer before passing in.
findNextFreeSlot(events: CalendarEvent[], startAfter: number, duration: number): number | null

// Schedule all todos in priority order with buffer between each.
// Returns new events + a map of todoId → eventId.
autoScheduleQueue(
  todos: Todo[],
  existingEvents: CalendarEvent[],
  startCursor: number,
  date: string,
  bufferMinutes: number
): { events: CalendarEvent[], linkedIds: Record<string|number, string|number> }

// Expand a single event config into N repeat instances.
expandRepeat(base: Omit<CalendarEvent,'id'|'date'>, startDate: string, config: RepeatConfig): CalendarEvent[]

// Column-packing overlap layout — port computeLayout() from prototype exactly.
// Returns map of eventId → EventLayoutSlot
computeLayout(events: CalendarEvent[]): Record<string|number, EventLayoutSlot>
```

### Store (`src/store/`)

Use **Zustand** with `persist` middleware.
- Mobile: `AsyncStorage` from `@react-native-async-storage/async-storage`
- Web: `localStorage` (Zustand default)

```ts
// useCalendarStore.ts
interface CalendarStore {
  events: CalendarEvent[];
  addEvent:    (event: Omit<CalendarEvent,'id'>) => void;
  addEvents:   (events: Omit<CalendarEvent,'id'>[]) => void;  // batch (repeat)
  updateEvent: (id: CalendarEvent['id'], patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: CalendarEvent['id']) => CalendarEvent;    // returns deleted (for undo)
  restoreEvent:(event: CalendarEvent) => void;                // undo support
  deleteSeries:(seriesId: string, scope: EditScope, fromDate: string) => void;
}

// useTodoStore.ts
interface TodoStore {
  todos: Todo[];
  addTodo:      (todo: Omit<Todo,'id'|'done'|'scheduledEventId'>) => void;
  toggleDone:   (id: Todo['id']) => void;
  deleteTodo:   (id: Todo['id']) => void;
  linkToEvent:  (todoId: Todo['id'], eventId: CalendarEvent['id']) => void;
  unlinkEvent:  (eventId: CalendarEvent['id']) => void;  // called on event delete
}

// useSettingsStore.ts
interface SettingsStore {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

// Persist key — bump version on schema changes
const PERSIST_KEY = "1440-planner-v1";
```

### Hooks (`src/hooks/`)

```ts
// useCurrentMinute.ts — polls every 30s, returns 0–1439
export function useCurrentMinute(): number

// useUndoDelete.ts — manages the 4s undo window
export function useUndoDelete(): {
  undoEntry: { event: CalendarEvent; linkedTodoId: id | null } | null;
  triggerDelete: (event: CalendarEvent, linkedTodoId?: id) => void;
  undo: () => void;
  dismiss: () => void;
}
```

---

## Phase 2 — Mobile App (`apps/mobile`)

### Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~51.0.0 | Managed workflow |
| `expo-router` | ~3.5.0 | File-based navigation |
| `react-native-svg` | ^15.0.0 | Watch face + event arcs |
| `react-native-reanimated` | ~3.10.0 | Timeline scroll, drag gestures |
| `react-native-gesture-handler` | ~2.16.0 | Long-press, pan |
| `@react-native-async-storage/async-storage` | ^1.23.0 | Persistence |
| `zustand` | ^4.5.0 | State (same as core) |
| `date-fns` | ^3.6.0 | Date math |
| `expo-notifications` | ~0.28.0 | Block reminders |
| `expo-haptics` | ~13.0.0 | Creation feedback |
| `nanoid` | ^5.0.0 | Collision-safe IDs (replaces `Date.now()`) |

### Screens

| File | Route | Purpose |
|------|-------|---------|
| `app/_layout.tsx` | root | ThemeProvider, gesture handler, nav tabs |
| `app/index.tsx` | `/` | Redirect → `/day` |
| `app/day.tsx` | `/day` | Calendar grid (primary) |
| `app/watch.tsx` | `/watch` | Full-screen watch face |
| `app/tasks.tsx` | `/tasks` | Task backlog |
| `app/settings.tsx` | `/settings` | Settings (native screen, not modal) |

### Component Map

Port each component below **directly from the prototype**. The logic is
validated — your job is the React Native translation, not redesign.

---

#### `DayGrid.tsx`
The scrollable 1440-minute timeline. This is the most complex component.

- Use `ScrollView` with a `ref` — scroll to `currentMinute * PPM` on mount
- The inner `View` has a fixed height of `MINUTES_IN_DAY * PPM`
- Hour lines and 15-min dashes: absolute-positioned `View` with `borderTopWidth`
- Wake/sleep shading: two absolute `View`s with `rgba(0,0,0,0.35)` background
- NOW line: absolute `View` + amber/cyan pill badge, today only
- `EventBlock` components: absolutely positioned by `startMinute * PPM`
- **Overlap layout**: call `computeLayout(dayEvents)` from `@1440/core`, pass
  `layout={layoutMap[ev.id]}` to each `EventBlock`. Block width = `(available - RULER_WIDTH) / totalColumns`.
- Long-press on empty space → measure tap Y → snap to 15-min grid → open `BlockModal`
- Tap event → set selected event → open `EventDetailSheet`

```tsx
// Key measurements (match prototype exactly)
const PPM      = 2.8;   // pixels per minute — tune for device density
const RULER_W  = 76;    // left ruler width in px
```

---

#### `EventBlock.tsx`
```tsx
interface EventBlockProps {
  event:    CalendarEvent;
  layout:   EventLayoutSlot;
  selected: boolean;
  onPress:  (event: CalendarEvent) => void;
}
```
- Category color for `borderLeftColor` (3px), background, and dot
- `☑` badge if `event.fromTodo`, `↺` badge if `event.seriesId`
- Highlight ring (`outline` equivalent: extra `View` border) when selected or flashing

---

#### `WatchCanvas.tsx`
Port the SVG watch face from the prototype using `react-native-svg`.

Every web SVG element maps 1:1:
```
<svg>        → <Svg>
<circle>     → <Circle>
<path>       → <Path>
<line>       → <Line>
<text>       → <SvgText>
<defs>       → <Defs>
<filter>     → not supported — remove blur filters, keep the shapes
<radialGradient> → <RadialGradient>
```

Props: `currentMinute`, `events: CalendarEvent[]`, `countMode: "up"|"down"`

This component is **also used as a preview** in the Wear OS complication
configuration screen — keep it prop-driven with no internal state.

---

#### `MinuteInput.tsx`
**Port this component exactly from the prototype.** It is already fully designed
and validated. Key behaviors:
- Default mode: numeric input for 0–1440
- Toggle mode: H input + MM input + AM/PM button
- Toggle trigger: tapping the helper text below the input
- Both modes stay in sync — changing one updates the other
- On mobile: `keyboardType="number-pad"` for the minute field

```tsx
interface MinuteInputProps {
  value:        number;          // 0–1439
  onChange:     (v: number) => void;
  accentColor?: string;          // border color for active input
}
```

---

#### `BlockModal.tsx`
Bottom sheet (use `@gorhom/bottom-sheet`) for new event creation.

Fields in order (all from prototype):
1. Title text input (placeholder = category name if empty)
2. Date — `DateTimePicker` (expo or community)
3. Start — `MinuteInput`
4. Duration — `MinuteInput` + quick-select row (15/30/45/60/90/120m)
5. Category — 2-column grid of buttons
6. Repeat — collapsible section (▶ REPEAT), reveals: None/Daily/Weekly/Custom chips, interval input, count input

On confirm: `resolveTitle(title, category)` → `addEvent()` or `addEvents()` (repeat).
Haptic: `expo-haptics` medium impact on submit.

---

#### `EventDetailSheet.tsx`
Bottom sheet (or slide-in panel on tablet) for editing a selected event.

All fields are **live-edit** (match prototype behavior — no Save button):
- Title: `TextInput` onBlur commits
- Category: button grid, commits immediately
- Date: `DateTimePicker`, commits immediately
- Start: `MinuteInput`, commits on change
- Duration: `MinuteInput` + quick chips, commits on change
- Summary grid: FROM / TO / BLOCKS / DATE (read-only)
- DELETE button → `triggerDelete()` from `useUndoDelete` hook

For series events, show an `EditScope` action sheet on any change:
"Edit this event only / This and future / All in series"

---

#### `TodoPlacementPanel.tsx`
**New in v6.** Opens in the sidebar / bottom sheet when user taps PICK on a task.
This replaces the old inline picker in `TodoRow`.

Flow:
1. User taps PICK in Tasks view
2. App switches to Calendar view (`/day`)
3. `TodoPlacementPanel` opens alongside the grid
4. User sets date + start time (`MinuteInput`)
5. Taps PLACE ON CALENDAR → `scheduleTodoAt()` → panel closes, event flashes

```tsx
interface TodoPlacementPanelProps {
  todo:         Todo;
  selectedDate: string;
  accentColor:  string;
  onPlace:      (todo: Todo, startMinute: number, date: string) => void;
  onCancel:     () => void;
}
```

---

#### `SettingsPanel.tsx` / `app/settings.tsx`
On mobile, render as a native screen (not a modal). Controls:

| Setting | UI | Default |
|---------|-----|---------|
| `defaultDuration` | Chip row: 15/30/45/60/90/120m | 60 |
| `bufferMinutes` | Chip row: 0/5/10/15/30m | 15 |
| `wakeMinute` | `MinuteInput` | 360 (6 AM) |
| `sleepMinute` | `MinuteInput` | 1320 (10 PM) |
| `highlightConflicts` | Toggle switch | true |
| `countMode` | Segmented control: ▲ UP / ▼ DOWN | "up" |
| Notification lead time | Chip row: 5/10/15/30m | 15 |

---

#### `UndoToast.tsx`
Floating toast at bottom of screen. 4-second auto-dismiss.

```tsx
interface UndoToastProps {
  entry:     { event: CalendarEvent };
  onUndo:    () => void;
  onDismiss: () => void;
}
```

Use `Animated.Value` for slide-up entrance and fade-out on dismiss.

---

#### `DateStrip.tsx`
Horizontal `ScrollView` of 7 day buttons centered on `selectedDate`.
- Fixed width per button: 36px
- `scrollEnabled={true}`, `showsHorizontalScrollIndicator={false}`
- Dot indicator if `events.some(e => e.date === d)`
- TODAY button appears when not on today's date

---

### Notifications (`src/services/notifications.ts`)

```ts
import * as Notifications from 'expo-notifications';

// Call on app start — request permissions, set handler
async function initNotifications(): Promise<void>

// Schedule a local notification N minutes before block start
async function scheduleBlockReminder(
  event: CalendarEvent,
  minutesBefore: number
): Promise<string>                    // returns notificationId

async function cancelBlockReminder(notificationId: string): Promise<void>
async function cancelAllReminders(): Promise<void>

// Reschedule all of today's upcoming blocks (call after any edit)
async function syncTodayReminders(
  events: CalendarEvent[],
  leadMinutes: number
): Promise<void>
```

Request permissions on first launch via a prompt in `app/settings.tsx`.
Store granted `notificationIds` alongside each event in the calendar store.

---

### Watch Sync Stub (`src/services/watchSync.ts`)

```ts
import { Platform } from 'react-native';

export interface WatchSnapshot {
  version:      1;
  date:         string;
  currentMinute:number;
  countMode:    "up" | "down";
  events:       WatchEvent[];
  currentBlock: WatchEvent | null;
  nextBlock:    WatchEvent | null;
}

export interface WatchEvent {
  startMinute: number;
  duration:    number;
  title:       string;
  category:    string;
  color:       string;   // resolved hex from category
}

// Platform-branched — stub logs until native modules are built
export async function sendDaySnapshot(snapshot: WatchSnapshot): Promise<void> {
  if (Platform.OS === 'android') {
    // TODO: WearOSSyncModule.sendSnapshot(JSON.stringify(snapshot))
    console.log('[WatchSync] Android stub:', snapshot.currentMinute);
  } else if (Platform.OS === 'ios') {
    // TODO: WatchConnectivityModule.sendSnapshot(JSON.stringify(snapshot))
    console.log('[WatchSync] iOS stub:', snapshot.currentMinute);
  }
}

export function onWatchAction(
  callback: (action: { type: 'open_day' | 'add_block' }) => void
): () => void {
  // TODO: native event emitter subscription
  return () => {};   // unsubscribe noop
}
```

Trigger `sendDaySnapshot` on: app foreground, any event mutation, every 15 min
via `expo-task-manager` background task.

---

## Phase 3 — Data Persistence

### Local (required for MVP)

```ts
// Store key — bump suffix on breaking schema changes
const PERSIST_KEY = "1440-planner-v1";

// Migration shape
const migrations = {
  1: (state) => ({ ...state, settings: { ...defaultSettings, ...state.settings } }),
};
```

Include `version: number` in persisted state. On load, run migrations
sequentially if `version < current`.

### Cloud Sync (post-MVP)

Supabase schema in `backend/supabase/migrations/001_initial_schema.sql`.
Tables: `events`, `todos`, `settings` — all with `user_id UUID` and `updated_at TIMESTAMPTZ`.

Strategy: offline-first, last-write-wins on `updated_at`.
Gate entirely behind `EXPO_PUBLIC_SUPABASE_URL` — if empty, skip all sync silently.

---

## Phase 4 — Polish Checklist

```
App store readiness:
[ ] Haptic feedback on block creation (expo-haptics, medium impact)
[ ] Haptic on undo confirm (light impact)
[ ] Block drag-to-reschedule (long-press + PanGestureHandler on EventBlock)
[ ] Swipe left on EventBlock → delete with undo toast
[ ] EditScope action sheet for series events (instance / this_and_future / all)
[ ] Empty state illustrations (day, tasks, watch — each view)
[ ] Onboarding flow: 3 screens explaining the 1440 concept before first use
[ ] Notification lead time configurable in Settings (default 15m)
[ ] Accessibility: accessibilityLabel on all interactive elements
[ ] accessibilityRole="button" on all touchables
[ ] VoiceOver/TalkBack ordering matches visual order
[ ] Over-the-air updates via expo-updates
[ ] App icon + splash screen assets
[ ] Privacy policy URL (required for App Store)
[ ] Dark mode only — light mode tracked as future milestone
```

---

## Design Tokens

The prototype's `C` object — replicate as a typed theme in `packages/core/src/theme.ts`:

```ts
export const colors = {
  bg0: "#07090f",    // deepest background
  bg1: "#0a0e18",    // sidebar / panels
  bg2: "#0d1220",    // cards / modals
  bg3: "#111827",    // elevated cards / inputs
  border:   "#1f2d42",
  borderHi: "#2d4460",
  L1: "#f1f5f9",    // primary text
  L2: "#94a3b8",    // secondary text
  L3: "#64748b",    // label / caption
  L4: "#3d4f66",    // very dim (grid lines, ticks)
  gridHr:  "#1a2840",   // hour line
  gridQtr: "#111e2e",   // 15-min dashed line
  accentUp:   "#F59E0B",   // count-up mode (amber)
  accentDown: "#38BDF8",   // countdown mode (cyan)
  categories: {
    deep:     { color: "#F59E0B", bg: "rgba(245,158,11,0.18)"  },
    meeting:  { color: "#38BDF8", bg: "rgba(56,189,248,0.18)"  },
    admin:    { color: "#A78BFA", bg: "rgba(167,139,250,0.18)" },
    break:    { color: "#34D399", bg: "rgba(52,211,153,0.18)"  },
    personal: { color: "#FB923C", bg: "rgba(251,146,60,0.18)"  },
  },
} as const;
```

---

## Remaining Prototype Limitations (still to fix in mobile)

These were NOT resolved in v6 and need attention during the mobile build:

| Issue | Recommended Fix |
|-------|----------------|
| IDs use `Date.now() + Math.random()` | Replace with `nanoid()` throughout |
| No EditScope for series (edit-one vs edit-all) | Add `EditScope` action sheet in `EventDetailSheet` |
| `highlightConflicts` toggle wired in Settings but rendering not implemented | In `DayGrid`, when `highlightConflicts` is true, dim events that have `totalColumns === 1` while their time neighbors have conflicts |
| No notification lead time setting | Add to `SettingsPanel`, pass into `syncTodayReminders()` |
| Series deletion not implemented | Add `deleteSeries(seriesId, scope, fromDate)` to store |
| Repeat count max is UI-only (52) | Enforce in store + add to Settings if desired |
| No conflict between events on different columns is flagged to user | Consider warning in `EventDetailSheet` when saving would overlap |

---

## First Commands

```bash
cd 1440-planner
npm install

# Verify web prototype runs
npm run web
# → open http://localhost:5173, confirm all features work

# Bootstrap mobile
cd apps/mobile
npx expo install
npx expo start
# → scan QR with Expo Go on device
```

---

## Definition of Done (MVP)

```
Core:
[x] All prototype features work identically on mobile
[x] Events and todos persist across app restarts (AsyncStorage)
[x] Settings persist across restarts
[ ] Local notifications fire N minutes before blocks on today
[ ] Watch sync stubs log correctly (no crash, no native module error)

Quality:
[ ] iOS build: expo run:ios — no errors
[ ] Android build: expo run:android — no errors  
[ ] Physical device test via Expo Go (iOS + Android)
[ ] No crash on: rotate, background/foreground, date change at midnight

Stores:
[ ] App passes App Store review guidelines (privacy, permissions)
[ ] App passes Play Store review guidelines
```