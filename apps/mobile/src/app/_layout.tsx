import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, usePathname, useRouter } from 'expo-router';
import {
  DESIGN_TOKENS as C,
  useCalendarStore, useSettingsStore,
  useCurrentMinute,
} from '@1440/core';
import { initAllStores } from '../services/storage';
import { buildWatchSnapshot, syncToWatch } from '../services/watchSync';

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
      if (calHydrated && settingsHydrated) {
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
