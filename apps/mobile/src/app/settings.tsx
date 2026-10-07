import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DESIGN_TOKENS as C, useSettingsStore, minuteToTimeStr,
  useCategories, describeRange,
} from '@1440/core';
import type { Category } from '@1440/core';
import MinuteInput   from '../components/ui/MinuteInput';
import CategorySheet from '../components/ui/CategorySheet';

const DURATIONS  = [15, 30, 45, 60, 90, 120];
const BUFFERS    = [0, 5, 10, 15, 30];
const LEAD_TIMES = [0, 5, 10, 15, 30];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    countMode, bufferMinutes, defaultDuration,
    wakeMinute, sleepMinute, highlightConflicts, rulerShowClock, leadTimeMinutes,
    setCountMode, updateSetting,
  } = useSettingsStore();

  const ac = countMode === 'down' ? C.cyan : C.amber;

  // Categories (pass 11): the list lives in its own store; the sheet adds or
  // edits one. `sheet` is null (closed), 'add', or the category being edited.
  const categories = useCategories();
  const [sheet, setSheet] = useState<'add' | Category | null>(null);

  // Settings can be the first screen (planner1440:///settings deep link), in
  // which case there is no history and back() logs "GO_BACK was not handled".
  // canGoBack() is also false before the navigator mounts, which is the safe
  // default here.
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/day');
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: ac }]}>⚙ SETTINGS</Text>
        <Pressable onPress={close} style={s.closeBtn}>
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

        {/* Notification lead time */}
        <Section label="NOTIFICATION LEAD TIME">
          <View style={s.chips}>
            {LEAD_TIMES.map(v => (
              <Pressable
                key={v}
                style={[s.chip, leadTimeMinutes === v && { borderColor: ac, backgroundColor: `${ac}22` }]}
                onPress={() => updateSetting('leadTimeMinutes', v)}
              >
                <Text style={[s.chipText, leadTimeMinutes === v && { color: ac, fontWeight: '700' }]}>
                  {v === 0 ? 'At start' : `${v}m`}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.hint}>Remind me this long before each of today's blocks starts</Text>
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

        {/* Categories */}
        <Section label="CATEGORIES">
          <Pressable style={[s.addBtn, { borderColor: ac }]} onPress={() => setSheet('add')}>
            <Text style={[s.addBtnText, { color: ac }]}>+ CATEGORY</Text>
          </Pressable>
          <View style={s.catList}>
            {categories.map(cat => {
              const range = describeRange(cat);
              return (
                <Pressable key={cat.id} style={s.catRow} onPress={() => setSheet(cat)}>
                  <View style={[s.catDot, { backgroundColor: cat.color }]} />
                  <Text style={[s.catLabel, { color: cat.color }]} numberOfLines={1}>{cat.label}</Text>
                  <Text style={s.catRange}>{range || 'no range'}</Text>
                  <Text style={s.catChevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>
            Tap a category to rename, recolour, set a time range or delete it. A range is drawn
            as a faint band on the Day grid.
          </Text>
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
        <Pressable style={[s.doneBtn, { borderColor: ac, backgroundColor: `${ac}22` }]} onPress={close}>
          <Text style={[s.doneBtnText, { color: ac }]}>SAVE & CLOSE</Text>
        </Pressable>
      </ScrollView>

      {/* Add / edit category sheet. Keyed so a fresh form mounts per open. */}
      {sheet !== null && (
        <CategorySheet
          key={sheet === 'add' ? 'add' : sheet.id}
          visible
          onClose={() => setSheet(null)}
          category={sheet === 'add' ? undefined : sheet}
        />
      )}
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
  addBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 4, borderWidth: 1, marginBottom: 10,
  },
  addBtnText:   { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  catList:      { gap: 6 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
  },
  catDot:       { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  catLabel:     { flex: 1, fontSize: 11, fontWeight: '700', minWidth: 0 },
  catRange:     { fontSize: 9, color: C.L3, flexShrink: 0 },
  catChevron:   { fontSize: 16, color: C.L4, paddingLeft: 2 },
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
