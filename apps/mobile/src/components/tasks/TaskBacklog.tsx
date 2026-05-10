import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, SectionList,
  StyleSheet, Platform,
} from 'react-native';
import {
  CATEGORIES, PRIORITIES, DESIGN_TOKENS as C,
  useTodoStore, useCalendarStore, useSettingsStore,
  autoScheduleQueue, findNextFreeSlot,
  today, getCurrentMinute,
} from '@1440/core';
import type { Todo, Priority, CategoryId } from '@1440/core';
import TodoRow from './TodoRow';
import { nanoid } from 'nanoid/non-secure';

interface Props {
  pendingTodoId?: string | null;
  onPick: (todo: Todo) => void;
}

export default function TaskBacklog({ pendingTodoId, onPick }: Props) {
  const todos       = useTodoStore(s => s.todos);
  const addTodo     = useTodoStore(s => s.addTodo);
  const updateTodo  = useTodoStore(s => s.updateTodo);
  const deleteTodo  = useTodoStore(s => s.deleteTodo);
  const setDone     = useTodoStore(s => s.setDone);
  const linkEvent   = useTodoStore(s => s.linkEventToTodo);

  const addEvent    = useCalendarStore(s => s.addEvent);
  const events      = useCalendarStore(s => s.events);

  const { selectedDate, bufferMinutes } = useSettingsStore(s => ({
    selectedDate: s.selectedDate,
    bufferMinutes: s.bufferMinutes,
  }));

  const [showAdd,    setShowAdd]    = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [newNotes,   setNewNotes]   = useState('');
  const [newDur,     setNewDur]     = useState(30);
  const [newCat,     setNewCat]     = useState<CategoryId>('deep');
  const [newPri,     setNewPri]     = useState<Priority>('med');

  const pending   = todos.filter(t => t.status === 'pending');
  const scheduled = todos.filter(t => t.status === 'scheduled');
  const done      = todos.filter(t => t.status === 'done');

  const dayEvents = events.filter(e => e.date === selectedDate);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addTodo({
      id:              nanoid(),
      title:           newTitle.trim(),
      priority:        newPri,
      categoryId:      newCat,
      durationMinutes: newDur,
      notes:           newNotes.trim() || undefined,
      status:          'pending',
    });
    setNewTitle(''); setNewNotes(''); setNewDur(30); setNewCat('deep'); setNewPri('med');
    setShowAdd(false);
  };

  const handleSchedule = (todo: Todo) => {
    const withBuf = dayEvents.map(ev => ({ ...ev, durationMinutes: ev.durationMinutes + bufferMinutes }));
    const start   = findNextFreeSlot(withBuf, getCurrentMinute(), todo.durationMinutes);
    if (start === null) return;

    const cat = CATEGORIES.find(c => c.id === todo.categoryId);
    const ev = {
      id:              nanoid(),
      title:           todo.title,
      date:            selectedDate,
      startMinute:     start,
      durationMinutes: todo.durationMinutes,
      categoryId:      todo.categoryId,
      notes:           todo.notes,
      fromTodo:        true,
      linkedTodoId:    todo.id,
    };
    addEvent(ev);
    linkEvent(todo.id, ev.id);
  };

  const handleAutoAll = () => {
    const placements = autoScheduleQueue(pending, dayEvents, getCurrentMinute(), bufferMinutes);
    for (const { todo, startMinute } of placements) {
      const ev = {
        id:              nanoid(),
        title:           todo.title,
        date:            selectedDate,
        startMinute,
        durationMinutes: todo.durationMinutes,
        categoryId:      todo.categoryId,
        notes:           todo.notes,
        fromTodo:        true,
        linkedTodoId:    todo.id,
      };
      addEvent(ev);
      linkEvent(todo.id, ev.id);
    }
  };

  const sections = [
    { title: 'PENDING',     data: pending   },
    { title: 'ON CALENDAR', data: scheduled },
    { title: 'DONE',        data: done      },
  ].filter(s => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={t => t.id}
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <View style={s.header}>
          <Text style={s.headerTitle}>TASKS</Text>
          <View style={s.headerActions}>
            {pending.length > 0 && (
              <Pressable style={s.autoAllBtn} onPress={handleAutoAll}>
                <Text style={s.autoAllText}>AUTO-SCHEDULE ALL</Text>
              </Pressable>
            )}
            <Pressable style={s.addBtn} onPress={() => setShowAdd(v => !v)}>
              <Text style={s.addBtnText}>{showAdd ? '✕' : '+ TASK'}</Text>
            </Pressable>
          </View>

          {showAdd && (
            <View style={s.addForm}>
              <TextInput
                style={s.addInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Task title…"
                placeholderTextColor={C.L3}
                autoFocus
              />
              <TextInput
                style={[s.addInput, s.notesInput]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Notes (optional)…"
                placeholderTextColor={C.L3}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lbl}>DURATION (MIN)</Text>
                  <TextInput
                    style={[s.addInput, { fontSize: 11 }]}
                    keyboardType="numeric"
                    value={String(newDur)}
                    onChangeText={t => setNewDur(Math.max(5, parseInt(t) || 30))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lbl}>PRIORITY</Text>
                  <View style={s.pillRow}>
                    {PRIORITIES.map(p => (
                      <Pressable
                        key={p.id}
                        style={[s.pill, newPri === p.id && { borderColor: p.color, backgroundColor: `${p.color}22` }]}
                        onPress={() => setNewPri(p.id as Priority)}
                      >
                        <Text style={[s.pillText, newPri === p.id && { color: p.color }]}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <View>
                <Text style={s.lbl}>CATEGORY</Text>
                <View style={s.pillRow}>
                  {CATEGORIES.map(c => (
                    <Pressable
                      key={c.id}
                      style={[s.pill, newCat === c.id && { borderColor: c.color, backgroundColor: c.bg }]}
                      onPress={() => setNewCat(c.id as CategoryId)}
                    >
                      <Text style={[s.pillText, newCat === c.id && { color: c.color }]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable style={s.submitAdd} onPress={handleAdd}>
                <Text style={s.submitAddText}>ADD TASK</Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={s.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TodoRow
          todo={item}
          isPicking={pendingTodoId === item.id}
          onDone={id => setDone(id, item.status !== 'done')}
          onDelete={deleteTodo}
          onSchedule={handleSchedule}
          onPick={onPick}
        />
      )}
      stickySectionHeadersEnabled={false}
    />
  );
}

const s = StyleSheet.create({
  content:     { padding: 14 },
  header:      { marginBottom: 10 },
  headerTitle: { fontSize: 10, color: C.L3, letterSpacing: 2, marginBottom: 10 },
  headerActions: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  autoAllBtn:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: C.amber },
  autoAllText: { fontSize: 9, color: C.amber, fontWeight: '700', letterSpacing: 1 },
  addBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: C.border },
  addBtnText:  { fontSize: 9, color: C.L2, letterSpacing: 0.5 },
  addForm:     { gap: 10, marginBottom: 10 },
  addInput: {
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border,
    borderRadius: 4, color: C.L1, fontSize: 13,
  },
  notesInput: { minHeight: 48, fontSize: 11, paddingTop: 8 },
  formRow:     { flexDirection: 'row', gap: 10 },
  lbl:         { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3,
    borderWidth: 1, borderColor: C.border,
  },
  pillText:    { fontSize: 9, color: C.L2 },
  submitAdd: {
    padding: 9, borderRadius: 4,
    backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: C.amber,
    alignItems: 'center',
  },
  submitAddText: { fontSize: 10, color: C.amber, fontWeight: '700', letterSpacing: 1 },
  sectionHeader: { fontSize: 8, color: C.L4, letterSpacing: 2, marginBottom: 6, marginTop: 12 },
});
