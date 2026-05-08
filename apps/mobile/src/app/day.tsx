import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DESIGN_TOKENS as C, MINUTES_IN_DAY,
  useCalendarStore, useTodoStore, useSettingsStore,
  useCurrentMinute, expandRepeat, minuteToTimeStr, isToday,
  today,
} from '@1440/core';
import type { CalendarEvent, Todo } from '@1440/core';
import DateStrip   from '../components/calendar/DateStrip';
import DayGrid     from '../components/calendar/DayGrid';
import BlockModal  from '../components/ui/BlockModal';
import { nanoid }  from 'nanoid/non-secure';

interface UndoEntry {
  event:        CalendarEvent;
  linkedTodoId: string | null;
  timer:        ReturnType<typeof setTimeout>;
}

export default function DayScreen() {
  const router         = useRouter();
  const currentMinute  = useCurrentMinute();

  const events     = useCalendarStore(s => s.events);
  const addEvents  = useCalendarStore(s => s.addEvents);
  const updateEvent = useCalendarStore(s => s.updateEvent);
  const deleteEvent = useCalendarStore(s => s.deleteEvent);

  const unlinkTodo = useTodoStore(s => s.unlinkEventFromTodo);
  const todos      = useTodoStore(s => s.todos);

  const { selectedDate, setSelectedDate, countMode, wakeMinute, sleepMinute, defaultDuration } =
    useSettingsStore(s => ({
      selectedDate:    s.selectedDate,
      setSelectedDate: s.setSelectedDate,
      countMode:       s.countMode,
      wakeMinute:      s.wakeMinute,
      sleepMinute:     s.sleepMinute,
      defaultDuration: s.defaultDuration,
    }));

  const [selEv,       setSelEv]       = useState<CalendarEvent | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [newStart,    setNewStart]    = useState(0);
  const [undoEntry,   setUndoEntry]   = useState<UndoEntry | null>(null);

  const ac        = countMode === 'down' ? C.cyan : C.amber;
  const dayEvents = events.filter(e => e.date === selectedDate);
  const todayFlag = isToday(selectedDate);

  const totalScheduled = dayEvents.reduce((s, e) => s + e.durationMinutes, 0);
  const freeTime       = Math.max(0, (sleepMinute - wakeMinute) - totalScheduled);

  const allDatesWithEvents = [...new Set(events.map(e => e.date))];

  const handleLongPress = useCallback((startMinute: number) => {
    setNewStart(startMinute);
    setSelEv(null);
    setShowModal(true);
  }, []);

  const handleAddEvents = (newEvents: CalendarEvent[]) => {
    addEvents(newEvents);
  };

  const handleDeleteEvent = (id: string) => {
    const ev       = events.find(e => e.id === id);
    const linkedTd = todos.find(t => t.linkedEventId === id);
    if (!ev) return;

    deleteEvent(id);
    setSelEv(null);

    if (undoEntry?.timer) clearTimeout(undoEntry.timer);
    const timer = setTimeout(() => setUndoEntry(null), 4000);
    setUndoEntry({ event: ev, linkedTodoId: linkedTd?.id ?? null, timer });
  };

  const handleUndo = () => {
    if (!undoEntry) return;
    clearTimeout(undoEntry.timer);
    addEvents([undoEntry.event]);
    if (undoEntry.linkedTodoId) {
      useTodoStore.getState().linkEventToTodo(undoEntry.linkedTodoId, undoEntry.event.id);
    }
    setUndoEntry(null);
  };

  return (
    <View style={s.root}>
      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        datesWithEvents={allDatesWithEvents}
        onSelect={setSelectedDate}
      />

      {/* Day summary bar */}
      <View style={s.summaryBar}>
        <Text style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: ac }]}>{totalScheduled}</Text>
          {'m scheduled'}
        </Text>
        <Text style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: C.L2 }]}>{freeTime}</Text>
          {'m free'}
        </Text>
        <Text style={s.summaryItem}>
          <Text style={[s.summaryNum, { color: C.L2 }]}>{dayEvents.length}</Text>
          {' blocks'}
        </Text>
        <Pressable style={s.settingsBtn} onPress={() => router.push('/settings')}>
          <Text style={s.settingsIcon}>⚙</Text>
        </Pressable>
      </View>

      {/* Timeline */}
      <DayGrid
        events={dayEvents}
        selectedEvent={selEv}
        currentMinute={currentMinute}
        countMode={countMode}
        accentColor={ac}
        wakeMinute={wakeMinute}
        sleepMinute={sleepMinute}
        isToday={todayFlag}
        onSelectEvent={ev => setSelEv(prev => prev?.id === ev.id ? null : ev)}
        onLongPress={handleLongPress}
      />

      {/* Floating add button */}
      <Pressable
        style={[s.fab, { backgroundColor: ac }]}
        onPress={() => { setNewStart(currentMinute); setSelEv(null); setShowModal(true); }}
      >
        <Text style={s.fabText}>+ BLOCK</Text>
      </Pressable>

      {/* Add block modal */}
      {showModal && (
        <BlockModal
          mode="add"
          visible={showModal}
          onClose={() => setShowModal(false)}
          initialDate={selectedDate}
          initialStart={newStart}
          defaultDuration={defaultDuration}
          accentColor={ac}
          onAdd={handleAddEvents}
        />
      )}

      {/* Edit block sheet */}
      {selEv && (
        <BlockModal
          mode="edit"
          visible={!!selEv}
          onClose={() => setSelEv(null)}
          event={selEv}
          accentColor={ac}
          onUpdate={updateEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Undo toast */}
      {undoEntry && (
        <View style={s.toast}>
          <Text style={s.toastText} numberOfLines={1}>
            Deleted "{undoEntry.event.title}"
          </Text>
          <Pressable onPress={handleUndo}>
            <Text style={[s.toastAction, { color: ac }]}>UNDO</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.bg1, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  summaryItem: { fontSize: 9, color: C.L3 },
  summaryNum:  { fontSize: 11, fontWeight: '700' },
  settingsBtn: { marginLeft: 'auto' as any, padding: 4 },
  settingsIcon: { fontSize: 14, color: C.L3 },
  fab: {
    position: 'absolute', bottom: 16, right: 16,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 6, elevation: 4, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  fabText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  toast: {
    position: 'absolute', bottom: 70, left: 20, right: 20,
    backgroundColor: C.bg2, borderRadius: 8,
    borderWidth: 1, borderColor: C.borderHi,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    elevation: 8,
  },
  toastText:   { flex: 1, color: C.L2, fontSize: 11, marginRight: 12 },
  toastAction: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
