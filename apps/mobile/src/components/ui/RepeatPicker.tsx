import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS as C } from '@1440/core';
import type { RepeatConfig, RepeatMode } from '@1440/core';

interface Props {
  value:    RepeatConfig;
  onChange: (r: RepeatConfig) => void;
}

const MODES: { id: RepeatMode; label: string }[] = [
  { id: 'none',   label: 'None'   },
  { id: 'daily',  label: 'Daily'  },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom' },
];

export default function RepeatPicker({ value, onChange }: Props) {
  const set = (patch: Partial<RepeatConfig>) => onChange({ ...value, ...patch });

  return (
    <View style={s.root}>
      <View style={s.modes}>
        {MODES.map(m => {
          const active = m.id === value.mode;
          return (
            <Pressable
              key={m.id}
              style={[s.btn, active && s.btnActive]}
              onPress={() => set({ mode: m.id })}
            >
              <Text style={[s.btnText, active && s.btnTextActive]}>{m.label}</Text>
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
            <Text style={s.lbl}>REPEATS</Text>
            <TextInput
              style={s.input}
              keyboardType="numeric"
              value={String(value.count ?? 4)}
              onChangeText={t => set({ count: Math.max(1, parseInt(t) || 4) })}
            />
          </View>
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
  btnActive:   { borderColor: C.cyan, backgroundColor: 'rgba(56,189,248,0.15)' },
  btnText:     { color: C.L3, fontSize: 10, letterSpacing: 0.8, fontWeight: '600' },
  btnTextActive: { color: C.cyan },
  opts:        { flexDirection: 'row', gap: 12 },
  field:       { flex: 1 },
  lbl:         { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  input: {
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: C.bg0, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 4, color: C.L1,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 13,
  },
});
