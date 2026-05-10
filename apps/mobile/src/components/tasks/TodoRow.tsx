import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CATEGORIES, PRIORITIES, DESIGN_TOKENS as C } from '@1440/core';
import type { Todo } from '@1440/core';

interface Props {
  todo:       Todo;
  isPicking:  boolean;
  onDone:     (id: string) => void;
  onDelete:   (id: string) => void;
  onSchedule: (todo: Todo) => void;
  onPick:     (todo: Todo) => void;
}

export default function TodoRow({ todo, isPicking, onDone, onDelete, onSchedule, onPick }: Props) {
  if (!todo) return null;
  const cat        = CATEGORIES.find(c => c.id === todo.categoryId);
  const pri        = PRIORITIES.find(p => p.id === todo.priority);
  const isScheduled = todo.status === 'scheduled';
  const isDone      = todo.status === 'done';

  const borderLeftColor = isDone ? C.L4 : isPicking ? cat?.color : isScheduled ? '#34D399' : pri?.color ?? '#fff';

  return (
    <View style={[
      s.row,
      { borderColor: isPicking ? `${cat?.color}60` : isScheduled ? '#1a3d2a' : C.border },
      { borderLeftColor },
      isDone && s.rowDone,
    ]}>
      {/* Checkbox */}
      <Pressable
        style={[s.checkbox, { borderColor: isDone ? C.L3 : pri?.color ?? C.border }]}
        onPress={() => onDone(todo.id)}
      >
        {isDone && <Text style={s.check}>✓</Text>}
      </Pressable>

      {/* Content */}
      <View style={s.content}>
        <Text
          style={[s.title, isDone && s.titleDone]}
          numberOfLines={1}
        >
          {todo.title}
        </Text>
        {!!todo.notes && (
          <Text style={s.notes} numberOfLines={1}>{todo.notes}</Text>
        )}
        <View style={s.tags}>
          <Text style={[s.tag, { color: cat?.color, backgroundColor: cat?.bg }]}>{cat?.label}</Text>
          <Text style={[s.priTag, { color: pri?.color }]}>{pri?.label}</Text>
          <Text style={s.durTag}>{todo.durationMinutes}m</Text>
          {isScheduled && <Text style={s.calTag}>on calendar</Text>}
          {isPicking   && <Text style={[s.calTag, { color: cat?.color }]}>PLACING →</Text>}
        </View>
      </View>

      {/* Actions */}
      {!isDone && !isScheduled && (
        <View style={s.actions}>
          <Pressable style={s.autoBtn} onPress={() => onSchedule(todo)}>
            <Text style={s.autoBtnText}>AUTO</Text>
          </Pressable>
          <Pressable
            style={[s.pickBtn, isPicking && s.pickBtnActive]}
            onPress={() => onPick(todo)}
          >
            <Text style={s.pickBtnText}>{isPicking ? '✕' : 'PICK'}</Text>
          </Pressable>
          <Pressable style={s.delBtn} onPress={() => onDelete(todo.id)}>
            <Text style={s.delBtnText}>✕</Text>
          </Pressable>
        </View>
      )}
      {isDone && (
        <Pressable style={s.delBtn} onPress={() => onDelete(todo.id)}>
          <Text style={s.delBtnText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 6,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  rowDone: { opacity: 0.5 },
  checkbox: {
    width: 16, height: 16, borderRadius: 3,
    borderWidth: 1.5, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2, flexShrink: 0,
  },
  check:     { color: C.L2, fontSize: 9 },
  content:   { flex: 1, minWidth: 0 },
  title: {
    fontSize: 12, color: C.L1, fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    marginBottom: 4,
  },
  titleDone: { color: C.L3, textDecorationLine: 'line-through' },
  notes:     { fontSize: 10, color: C.L3, marginBottom: 4, fontStyle: 'italic' },
  tags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag:       { fontSize: 9, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  priTag:    { fontSize: 9, fontWeight: '600' },
  durTag:    { fontSize: 9, color: C.L3 },
  calTag:    { fontSize: 9, color: '#34D399', backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  actions:   { flexDirection: 'row', gap: 4, flexShrink: 0 },
  autoBtn:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, backgroundColor: 'rgba(52,211,153,0.15)', borderWidth: 1, borderColor: '#34D399' },
  autoBtnText: { fontSize: 9, color: '#34D399', fontWeight: '700' },
  pickBtn:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: '#38BDF8' },
  pickBtnActive: { backgroundColor: 'rgba(56,189,248,0.3)' },
  pickBtnText: { fontSize: 9, color: '#38BDF8', fontWeight: '700' },
  delBtn:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3, borderWidth: 1, borderColor: C.border },
  delBtnText:  { fontSize: 11, color: C.L3 },
});
