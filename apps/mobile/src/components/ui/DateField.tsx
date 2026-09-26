import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DESIGN_TOKENS as C, formatDateDisplay } from '@1440/core';
import MonthGrid from '../calendar/MonthGrid';

// A tappable date value that unfolds the shared MonthGrid beneath it. Replaces
// the bare YYYY-MM-DD TextInput the block modal used to have.

interface Props {
  value:        string;           // YYYY-MM-DD
  onChange:     (date: string) => void;
  accentColor?: string;
  compact?:     boolean;          // shorter field (used inside the repeat picker)
}

export default function DateField({ value, onChange, accentColor = C.amber, compact }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        style={[s.field, compact && s.fieldCompact, open && { borderColor: accentColor }]}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={[s.value, compact && s.valueCompact]} numberOfLines={1}>
          {formatDateDisplay(value)}
        </Text>
        <Text style={[s.chevron, { color: accentColor }]}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View style={s.popover}>
          <MonthGrid
            selectedDate={value}
            accentColor={accentColor}
            onSelect={d => { onChange(d); setOpen(false); }}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border, borderRadius: 4,
  },
  fieldCompact: { paddingVertical: 5, borderWidth: 1.5 },
  value:        { color: C.L1, fontSize: 12, flex: 1 },
  valueCompact: { fontSize: 11 },
  chevron:      { fontSize: 8, marginLeft: 6 },
  popover: {
    marginTop: 4,
    backgroundColor: C.bg1, borderWidth: 1, borderColor: C.borderHi, borderRadius: 6,
  },
});
