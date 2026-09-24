import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, usePathname, useRouter, useRootNavigationState } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  DESIGN_TOKENS as C,
  useCalendarStore, useSettingsStore, useTodoStore,
  useCurrentMinute, today,
} from '@1440/core';
import type { CalendarEvent } from '@1440/core';
import { initAllStores } from '../services/storage';
import { buildWatchSnapshot, syncToWatch } from '../services/watchSync';
import {
  requestPermissions, hasPermissions, scheduleDailyReminder, reminderDateFromResponse,
} from '../services/notifications';

// Coalesces the burst of store updates a drag/resize gesture emits into one
// native cancel-all + reschedule.
const RESCHEDULE_DEBOUNCE_MS = 500;

const eventsOn = (events: CalendarEvent[], date: string) => events.filter(e => e.date === date);

// updateEvent() keeps object identity for untouched events, so a shallow
// compare of the today-subset tells us whether today actually changed.
const sameEvents = (a: CalendarEvent[], b: CalendarEvent[]) =>
  a.length === b.length && a.every((e, i) => e === b[i]);

// Initialize storage adapters synchronously before any store is used
initAllStores();

const TABS = [
  { path: '/day',      label: 'DAY'   },
  { path: '/watch',    label: 'WATCH' },
  { path: '/tasks',    label: 'TASKS' },
] as const;

export default function RootLayout() {
  const pathname    = usePathname();
  const router      = useRouter();
  const currentMinute = useCurrentMinute();

  // Hydration gate: wait for stores to rehydrate from AsyncStorage
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let checks = 0;
    const waitForHydration = () => {
      const calHydrated      = useCalendarStore.persist.hasHydrated();
      const settingsHydrated = useSettingsStore.persist.hasHydrated();
      const todoHydrated     = useTodoStore.persist.hasHydrated();
      if (calHydrated && settingsHydrated && todoHydrated) {
        setHydrated(true);
      } else if (checks < 50) {
        checks++;
        setTimeout(waitForHydration, 50);
      } else {
        // Fail-safe: render anyway after 2.5s
        setHydrated(true);
      }
    };
    waitForHydration();
  }, []);

  // Watch sync subscription
  useEffect(() => {
    const unsub = useCalendarStore.subscribe(state => {
      const settings = useSettingsStore.getState();
      const snapshot = buildWatchSnapshot({
        events:        state.events,
        date:          settings.selectedDate,
        currentMinute,
        countMode:     settings.countMode,
        wakeMinute:    settings.wakeMinute,
        sleepMinute:   settings.sleepMinute,
      });
      syncToWatch(snapshot);
    });
    return unsub;
  }, [currentMinute]);

  // Local notifications: ask once after hydration, then keep *today's*
  // reminders in sync. Deliberately keyed on `hydrated` only — see the
  // watch-sync effect above for why `currentMinute` must not be a dep here.
  const rescheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    let granted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (!granted) return;
      const date = today();
      const { events }          = useCalendarStore.getState();
      const { leadTimeMinutes } = useSettingsStore.getState();
      scheduleDailyReminder(eventsOn(events, date), date, leadTimeMinutes)
        .catch(err => console.warn('[notifications] reschedule failed', err));
    };
    const reschedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, RESCHEDULE_DEBOUNCE_MS);
    };
    rescheduleRef.current = reschedule;

    requestPermissions().then(ok => { granted = ok; reschedule(); });

    // Calendar mutations — only when today's events changed. Editing another
    // day (selectedDate is not today) must not touch today's notifications.
    let prevToday = eventsOn(useCalendarStore.getState().events, today());
    const unsubCalendar = useCalendarStore.subscribe(state => {
      const nextToday = eventsOn(state.events, today());
      const changed = !sameEvents(prevToday, nextToday);
      prevToday = nextToday;
      if (changed) reschedule();
    });

    const unsubSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.leadTimeMinutes !== prev.leadTimeMinutes) reschedule();
    });

    // Foreground: permission may have changed in system settings, or the date
    // may have rolled over while backgrounded.
    const appState = AppState.addEventListener('change', status => {
      if (status !== 'active') return;
      hasPermissions().then(ok => { granted = ok; reschedule(); });
    });

    return () => {
      unsubCalendar();
      unsubSettings();
      appState.remove();
      if (timer) clearTimeout(timer);
      rescheduleRef.current = null;
    };
  }, [hydrated]);

  // Midnight rollover while the app stays in the foreground: `today()` flips,
  // so the new day's blocks need scheduling. currentMinute re-renders us every
  // 30s, which is what makes this string change.
  const todayStr = today();
  useEffect(() => { rescheduleRef.current?.(); }, [todayStr]);

  // Reminder taps → Day on the block's date. A tap that cold-starts the app
  // arrives before any JS listener exists, so the last response is also read
  // once the navigator is ready (root state has a key — navigating earlier
  // throws), then cleared so a reload doesn't replay the jump.
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (!hydrated || !navReady) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const date = reminderDateFromResponse(response);
      if (!date) return;
      useSettingsStore.getState().setSelectedDate(date);
      router.replace('/day');
    };

    const sub = Notifications.addNotificationResponseReceivedListener(open);
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (!response) return;
        open(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(err => console.warn('[notifications] reminder tap handling failed', err));

    return () => sub.remove();
  }, [hydrated, navReady]);

  if (!hydrated) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={C.amber} size="large" />
        <Text style={s.loadingText}>1440</Text>
      </View>
    );
  }

  const activeTab = TABS.find(t => pathname.startsWith(t.path));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={s.root}>
          {/* Screen content */}
          <View style={s.content}>
            <Slot />
          </View>

          {/* Custom bottom tab bar */}
          <SafeAreaView edges={['bottom']} style={s.tabBar}>
            <View style={s.tabRow}>
              {TABS.map(tab => {
                const active = activeTab?.path === tab.path;
                return (
                  <Pressable
                    key={tab.path}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => router.push(tab.path)}
                  >
                    <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg0 },
  content:  { flex: 1 },
  loading:  { flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: C.amber, fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  tabBar:   { backgroundColor: C.bg1, borderTopWidth: 1, borderTopColor: C.border },
  tabRow:   { flexDirection: 'row', height: 48 },
  tab:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderTopWidth: 2, borderTopColor: C.amber },
  tabLabel:  { fontSize: 9, color: C.L3, letterSpacing: 1.5, fontWeight: '600' },
  tabLabelActive: { color: C.amber },
});
