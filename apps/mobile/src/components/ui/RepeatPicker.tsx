import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS as C, dateAddDays } from '@1440/core';
import type { RepeatConfig, RepeatMode } from '@1440/core';
import DateField from './DateField';

interface Props {
  value:     RepeatConfig;
  onChange:  (r: RepeatConfig) => void;
  startDate: string;   // first occurrence; seeds the "until" date
  accentColor?: string;
}

const MODES: { id: RepeatMode; label: string }[] = [
  { id: 'none',   label: 'None'   },
  { id: 'daily',  label: 'Daily'  },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom' },
];

// "Forever" is the absence of both `count` and `endDate` (Decisions on record).
type EndKind = 'never' | 'count' | 'date';
const ENDS: { id: EndKind; label: string }[] = [
  { id: 'never', label: 'Never'  },
  { id: 'count', label: 'After'  },
  { id: 'date',  label: 'On'     },
];

export default function RepeatPicker({ value, onChange, startDate, accentColor = C.cyan }: Props) {
  if (!value) return null;
  const set = (patch: Partial<RepeatConfig>) => onChange({ ...value, ...patch });
  const endKind: EndKind = value.count !== undefined ? 'count' : value.endDate ? 'date' : 'never';

  const setEnd = (kind: EndKind) => {
    if (kind === 'never') set({ count: undefined, endDate: undefined });
    if (kind === 'count') set({ count: value.count ?? 4, endDate: undefined });
    if (kind === 'date')  set({ count: undefined, endDate: value.endDate ?? dateAddDays(startDate, 28) });
  };

  return (
    <View style={s.root}>
      <View style={s.modes}>
        {MODES.map(m => {
          const active = m.id === value.mode;
          return (
            <Pressable
              key={m.id}
              style={[s.btn, active && { borderColor: accentColor, backgroundColor: `${accentColor}26` }]}
              onPress={() => set({ mode: m.id })}
            >
              <Text style={[s.btnText, active && { color: accentColor }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.mode !== 'none' && (
        <View style={s.opts}>
          {value.mode === 'custom' && (
            <View style={s.field}>
              <Text style={s.lbl}>EVERY (DAYS)</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={String(value.interval ?? 7)}
                onChangeText={t => set({ interval: Math.max(1, parseInt(t) || 7) })}
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.lbl}>ENDS</Text>
            <View style={s.modes}>
              {ENDS.map(e => {
                const active = e.id === endKind;
                return (
                  <Pressable
                    key={e.id}
                    style={[s.btn, active && { borderColor: accentColor, backgroundColor: `${accentColor}26` }]}
                    onPress={() => setEnd(e.id)}
                  >
                    <Text style={[s.btnText, active && { color: accentColor }]}>{e.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {endKind === 'count' && (
            <View style={s.field}>
              <Text style={s.lbl}>OCCURRENCES</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={String(value.count ?? 4)}
                onChangeText={t => set({ count: Math.max(1, parseInt(t) || 4) })}
              />
            </View>
          )}

          {endKind === 'date' && (
            <View style={s.field}>
              <Text style={s.lbl}>UNTIL</Text>
              <DateField
                value={value.endDate ?? startDate}
                onChange={d => set({ endDate: d < startDate ? startDate : d })}
                accentColor={accentColor}
                compact
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { gap: 10 },
  modes:       { flexDirection: 'row', gap: 6 },
  btn:         {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 4, borderWidth: 1, borderColor: C.border,
  },
  btnText:     { color: C.L3, fontSize: 10, letterSpacing: 0.8, fontWeight: '600' },
  opts:        { gap: 10 },
  field:       { gap: 4 },
  lbl:         { fontSize: 8, color: C.L3, letterSpacing: 1.5 },
  input: {
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: C.bg0, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 4, color: C.L1,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 13,
  },
});
