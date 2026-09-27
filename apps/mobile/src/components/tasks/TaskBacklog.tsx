import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import {
  DESIGN_TOKENS as C,
  useTodoStore, useCalendarStore, useSettingsStore,
  autoScheduleQueue, findNextFreeSlot, eventsOnDate,
  getCurrentMinute, resolveTodo, today, useCurrentMinute,
} from '@1440/core';
import type { Todo } from '@1440/core';
import TodoRow from './TodoRow';
import TodoSheet from './TodoSheet';
import { placeTodo } from '../../services/placeTodo';

interface Props {
  onPick: (todo: Todo) => void;
}

// A row is the todo as it stands *today*: for a repeating todo that is its
// current occurrence's status (resolveTodo), for a plain todo its stored one.
interface Row {
  view:            Todo;     // status swapped for the resolved one
  occurrenceDate?: string;
}

type Sheet = { mode: 'add' } | { mode: 'edit'; todo: Todo } | null;

export default function TaskBacklog({ onPick }: Props) {
  const todos       = useTodoStore(s => s.todos);
  const addTodo     = useTodoStore(s => s.addTodo);
  const updateTodo  = useTodoStore(s => s.updateTodo);
  const deleteTodo  = useTodoStore(s => s.deleteTodo);
  const setDone     = useTodoStore(s => s.setDone);

  const events      = useCalendarStore(s => s.events);

  const { selectedDate, bufferMinutes } = useSettingsStore(s => ({
    selectedDate: s.selectedDate,
    bufferMinutes: s.bufferMinutes,
  }));

  // Re-renders every 30 s so a repeating todo's row rolls over at midnight.
  const currentMinute = useCurrentMinute();
  const todayStr = useMemo(() => today(), [currentMinute]);

  const [sheet, setSheet] = useState<Sheet>(null);

  const rows: Row[] = useMemo(
    () => todos.map(t => {
      const r = resolveTodo(t, todayStr);
      return { view: { ...t, status: r.status }, occurrenceDate: r.occurrenceDate };
    }),
    [todos, todayStr],
  );
  const pending   = rows.filter(r => r.view.status === 'pending');
  const scheduled = rows.filter(r => r.view.status === 'scheduled');
  const done      = rows.filter(r => r.view.status === 'done');

  // Includes repeat occurrences, so AUTO never lands a task on top of one.
  const dayEvents = eventsOnDate(events, selectedDate);

  const handleSchedule = (todo: Todo) => {
    const withBuf = dayEvents.map(ev => ({ ...ev, durationMinutes: ev.durationMinutes + bufferMinutes }));
    const start   = findNextFreeSlot(withBuf, getCurrentMinute(), todo.durationMinutes);
    if (start === null) return;
    placeTodo(todo, selectedDate, start);
  };

  const handleAutoAll = () => {
    const placements = autoScheduleQueue(pending.map(r => r.view), dayEvents, getCurrentMinute(), bufferMinutes);
    for (const { todo, startMinute } of placements) {
      placeTodo(todo, selectedDate, startMinute);
    }
  };

  // The sheet edits the *stored* todo, not the resolved view.
  const openEdit = (view: Todo) => {
    const base = todos.find(t => t.id === view.id);
    if (base) setSheet({ mode: 'edit', todo: base });
  };

  const sections = [
    { title: 'PENDING',     data: pending   },
    { title: 'ON CALENDAR', data: scheduled },
    { title: 'DONE',        data: done      },
  ].filter(s => s.data.length > 0);

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={r => r.view.id}
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
              <Pressable style={s.addBtn} onPress={() => setSheet({ mode: 'add' })}>
                <Text style={s.addBtnText}>+ TASK</Text>
              </Pressable>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TodoRow
            todo={item.view}
            occurrenceDate={item.occurrenceDate}
            onDone={id => setDone(id, item.view.status !== 'done', item.occurrenceDate)}
            onDelete={deleteTodo}
            onSchedule={handleSchedule}
            onPick={onPick}
            onPress={openEdit}
          />
        )}
        stickySectionHeadersEnabled={false}
      />

      {sheet?.mode === 'add' && (
        <TodoSheet
          mode="add"
          visible
          onClose={() => setSheet(null)}
          onAdd={addTodo}
        />
      )}
      {sheet?.mode === 'edit' && (
        <TodoSheet
          mode="edit"
          visible
          todo={sheet.todo}
          onClose={() => setSheet(null)}
          onSave={updateTodo}
          onDelete={deleteTodo}
        />
      )}
    </>
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
  sectionHeader: { fontSize: 8, color: C.L4, letterSpacing: 2, marginBottom: 6, marginTop: 12 },
});
