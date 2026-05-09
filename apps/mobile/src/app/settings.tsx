import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Switch, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DESIGN_TOKENS as C, useSettingsStore, minuteToTimeStr,
} from '@1440/core';
import MinuteInput from '../components/ui/MinuteInput';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const BUFFERS   = [0, 5, 10, 15, 30];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    countMode, bufferMinutes, defaultDuration,
    wakeMinute, sleepMinute, highlightConflicts, rulerShowClock,
    setCountMode, updateSetting,
  } = useSettingsStore();

  const ac = countMode === 'down' ? C.cyan : C.amber;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: ac }]}>⚙ SETTINGS</Text>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Count mode */}
        <Section label="COUNT MODE">
          <View style={s.row}>
            {(['up', 'down'] as const).map(m => (
              <Pressable
                key={m}
                style={[s.modeBtn, countMode === m && { borderColor: ac, backgroundColor: `${ac}22` }]}
                onPress={() => setCountMode(m)}
              >
                <Text style={[s.modeBtnText, countMode === m && { color: ac }]}>
                  {m === 'up' ? '↑ COUNT UP' : '↓ COUNT DOWN'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.hint}>
            {countMode === 'up' ? 'Shows minutes elapsed (amber)' : 'Shows minutes remaining (cyan)'}
          </Text>
        </Section>

        {/* Default duration */}
        <Section label="DEFAULT BLOCK DURATION">
          <View style={s.chips}>
            {DURATIONS.map(d => (
              <Pressable
                key={d}
                style={[s.chip, defaultDuration === d && { borderColor: ac, backgroundColor: `${ac}22` }]}
                onPress={() => updateSetting('defaultDuration', d)}
              >
                <Text style={[s.chipText, defaultDuration === d && { color: ac, fontWeight: '700' }]}>{d}m</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Buffer */}
        <Section label="AUTO-SCHEDULE BUFFER">
          <View style={s.chips}>
            {BUFFERS.map(b => (
              <Pressable
                key={b}
                style={[s.chip, bufferMinutes === b && { borderColor: ac, backgroundColor: `${ac}22` }]}
                onPress={() => updateSetting('bufferMinutes', b)}
              >
                <Text style={[s.chipText, bufferMinutes === b && { color: ac, fontWeight: '700' }]}>{b}m</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.hint}>Gap inserted between auto-scheduled tasks</Text>
        </Section>

        {/* Wake / Sleep */}
        <Section label="ACTIVE WINDOW (shades grid outside)">
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>WAKE</Text>
              <MinuteInput
                value={wakeMinute}
                onChange={v => updateSetting('wakeMinute', Math.max(0, Math.min(720, v)))}
                accentColor={ac}
              />
              <Text style={s.hint}>{minuteToTimeStr(wakeMinute)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>SLEEP</Text>
              <MinuteInput
                value={sleepMinute}
                onChange={v => updateSetting('sleepMinute', Math.max(720, Math.min(1440, v)))}
              />
              <Text style={s.hint}>{minuteToTimeStr(sleepMinute)}</Text>
            </View>
          </View>
        </Section>

        {/* Conflict highlight */}
        <Section label="DISPLAY">
          <View style={s.row}>
            <Text style={s.switchLabel}>Highlight schedule conflicts</Text>
            <Switch
              value={highlightConflicts}
              onValueChange={v => updateSetting('highlightConflicts', v)}
              trackColor={{ false: C.bg3, true: ac }}
              thumbColor={C.L1}
            />
          </View>
          <View style={[s.row, { marginTop: 10 }]}>
            <Text style={s.switchLabel}>Show clock time in timeline ruler</Text>
            <Switch
              value={rulerShowClock}
              onValueChange={v => updateSetting('rulerShowClock', v)}
              trackColor={{ false: C.bg3, true: ac }}
              thumbColor={C.L1}
            />
          </View>
        </Section>

        {/* Done */}
        <Pressable style={[s.doneBtn, { borderColor: ac, backgroundColor: `${ac}22` }]} onPress={() => router.back()}>
          <Text style={[s.doneBtnText, { color: ac }]}>SAVE & CLOSE</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={ss.section}>
      <Text style={ss.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle:  { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  closeBtn:     { padding: 4 },
  closeBtnText: { color: C.L3, fontSize: 18 },
  content:      { padding: 18, gap: 2 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  twoCol:       { flexDirection: 'row', gap: 12 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 4, borderWidth: 1, borderColor: C.border,
  },
  chipText:     { fontSize: 10, color: C.L2 },
  modeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 4,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  modeBtnText:  { fontSize: 9, color: C.L3, fontWeight: '600', letterSpacing: 0.8 },
  hint:         { fontSize: 8, color: C.L3, marginTop: 4 },
  lbl:          { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  switchLabel:  { flex: 1, fontSize: 10, color: C.L2 },
  doneBtn: {
    marginTop: 10, padding: 11, borderRadius: 4,
    borderWidth: 1, alignItems: 'center',
  },
  doneBtnText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
});

const ss = StyleSheet.create({
  section:      { marginBottom: 22 },
  sectionLabel: { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 10 },
});
