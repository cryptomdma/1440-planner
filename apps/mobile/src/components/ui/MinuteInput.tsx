import React, { useState, useEffect, useRef } from 'react';
import {
  View, TextInput, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import { DESIGN_TOKENS as C, minuteToTimeStr, clockToMinute } from '@1440/core';

interface Props {
  value:       number;
  onChange:    (v: number) => void;
  accentColor?: string;
}

function toParts(v: number) {
  const clamped = Math.max(0, Math.min(1439, v));
  const h24 = Math.floor(clamped / 60) % 24;
  const mn  = clamped % 60;
  return {
    h:  String(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24),
    m:  String(mn).padStart(2, '0'),
    ap: h24 < 12 ? 'AM' : ('PM' as 'AM' | 'PM'),
  };
}

export default function MinuteInput({ value, onChange, accentColor }: Props) {
  const [mode, setMode] = useState<'min' | 'clock'>('min');
  const { h, m, ap } = toParts(value);
  const [ch,  setCh]  = useState(h);
  const [cm,  setCm]  = useState(m);
  const [cap, setCap] = useState<'AM' | 'PM'>(ap);
  const lastRef = useRef(value);

  useEffect(() => {
    if (lastRef.current !== value) {
      lastRef.current = value;
      const p = toParts(value);
      setCh(p.h); setCm(p.m); setCap(p.ap);
    }
  }, [value]);

  const color = accentColor ?? C.L1;

  return (
    <View>
      {mode === 'min' ? (
        <TextInput
          style={[s.input, { borderColor: color, color }]}
          keyboardType="numeric"
          value={String(value)}
          onChangeText={t => onChange(Math.max(0, Math.min(1440, parseInt(t) || 0)))}
        />
      ) : (
        <View style={s.row}>
          <TextInput
            style={[s.seg, { borderColor: color, color, width: 46 }]}
            keyboardType="numeric"
            value={ch}
            onChangeText={setCh}
            onBlur={() => onChange(clockToMinute(parseInt(ch) || 0, parseInt(cm) || 0, cap))}
            placeholder="12"
            placeholderTextColor={C.L4}
          />
          <Text style={s.colon}>:</Text>
          <TextInput
            style={[s.seg, { borderColor: C.border, color: C.L1, width: 46 }]}
            keyboardType="numeric"
            value={cm}
            onChangeText={setCm}
            onBlur={() => onChange(clockToMinute(parseInt(ch) || 0, parseInt(cm) || 0, cap))}
            placeholder="00"
            placeholderTextColor={C.L4}
          />
          <Pressable
            style={s.ampm}
            onPress={() => {
              const next: 'AM' | 'PM' = cap === 'AM' ? 'PM' : 'AM';
              setCap(next);
              onChange(clockToMinute(parseInt(ch) || 0, parseInt(cm) || 0, next));
            }}
          >
            <Text style={s.ampmText}>{cap}</Text>
          </Pressable>
        </View>
      )}
      <Pressable onPress={() => setMode(prev => prev === 'min' ? 'clock' : 'min')}>
        <Text style={s.toggle}>
          {'↕ '}
          {mode === 'min'
            ? `clock · ${minuteToTimeStr(value)}`
            : `minute · ${value}`}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: C.bg0,
    borderWidth: 1.5, borderRadius: 4,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 14, fontWeight: '700',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seg: {
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: C.bg0,
    borderWidth: 1.5, borderRadius: 4,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    fontSize: 14, fontWeight: '700',
    textAlign: 'center',
  },
  colon: { color: C.L2, fontSize: 16, fontWeight: '700' },
  ampm: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 4, borderWidth: 1, borderColor: C.borderHi,
    backgroundColor: C.bg3,
  },
  ampmText: {
    color: C.L1, fontSize: 11, fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
  },
  toggle: {
    marginTop: 4, fontSize: 9, color: C.cyan,
    letterSpacing: 1, fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
  },
});
