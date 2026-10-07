import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DESIGN_TOKENS as C, useCategories } from '@1440/core';

interface Props {
  value:    string;
  onChange: (id: string) => void;
}

// Chips for every category in the store — built-ins and user-made alike, in
// store order (the order Settings shows them in).
export default function CategoryPicker({ value, onChange }: Props) {
  const categories = useCategories();
  return (
    <View style={s.grid}>
      {categories.map(cat => {
        const active = cat.id === value;
        return (
          <Pressable
            key={cat.id}
            style={[s.chip, { borderColor: active ? cat.color : C.border, backgroundColor: active ? cat.bg : 'transparent' }]}
            onPress={() => onChange(cat.id)}
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
