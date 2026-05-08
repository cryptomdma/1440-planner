import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CATEGORIES, DESIGN_TOKENS as C } from '@1440/core';
import type { CategoryId } from '@1440/core';

interface Props {
  value:    CategoryId;
  onChange: (id: CategoryId) => void;
}

export default function CategoryPicker({ value, onChange }: Props) {
  return (
    <View style={s.grid}>
      {CATEGORIES.map(cat => {
        const active = cat.id === value;
        return (
          <Pressable
            key={cat.id}
            style={[s.chip, { borderColor: active ? cat.color : C.border, backgroundColor: active ? cat.bg : 'transparent' }]}
            onPress={() => onChange(cat.id as CategoryId)}
          >
            <View style={[s.dot, { backgroundColor: cat.color }]} />
            <Text style={[s.label, { color: active ? cat.color : C.L2 }]}>{cat.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 4, borderWidth: 1.5,
  },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '600' },
});
