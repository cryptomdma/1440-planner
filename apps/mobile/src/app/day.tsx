import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import type { PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  CATEGORIES, DESIGN_TOKENS as C, MINUTES_IN_DAY,
  useCalendarStore, useTodoStore, useSettingsStore,
  useCurrentMinute, minuteToTimeStr, isToday,
  today, dateAddDays,
  eventsOnDate, datesWithEvents, parseOccurrenceId, findSeries,
} from '@1440/core';
import type { CalendarEvent, SeriesScope } from '@1440/core';
import DateStrip   from '../components/calendar/DateStrip';
import DayGrid     from '../components/calendar/DayGrid';
import BlockModal  from '../components/ui/BlockModal';
import { placeTodo } from '../services/placeTodo';

// The date strip shows today ±365 days, so that is the window repeat rules are
// expanded over for its dots. A "forever" rule costs at most 731 steps here.
const STRIP_RANGE_DAYS = 365;

interface UndoEntry {
  title:   string;
  // Reverses whatever the delete did: re-adds a plain block (and re-links its
  // todo), clears an exception, restores a series' rule, or re-adds its base.
  restore: () => void;
  timer:   ReturnType<typeof setTimeout>;
}

export default function DayScreen() {
  const router         = useRouter();
  const currentMinute  = useCurrentMinute();

  const events       = useCalendarStore(s => s.events);
  const addEvents    = useCalendarStore(s => s.addEvents);
  const updateEvent  = useCalendarStore(s => s.updateEvent);
  const updateSeries = useCalendarStore(s => s.updateSeries);
  const deleteWithScope   = useCalendarStore(s => s.deleteWithScope);
  const restoreOccurrence = useCalendarStore(s => s.restoreOccurrence);

  const unlinkTodo = useTodoStore(s => s.unlinkEventFromTodo);
  const todos      = useTodoStore(s => s.todos);

  // Placement mode: Tasks → PICK pushes /day?pick=<todoId>. Resolved against the
  // store on every render, so an id that is missing or no longer pending simply
  // means "not placing". Ending placement clears the param in place (setParams)
  // rather than replace('/day'), which would remount the screen and reset the
  // grid's scroll position. A tab-bar tap pushes a fresh /day and drops it too.
  const { pick }  = useLocalSearchParams<{ pick?: string }>();
  const pickTodo  = typeof pick === 'string' && pick
    ? todos.find(t => t.id === pick && t.status === 'pending') ?? null
    : null;
  const pickCat   = pickTodo ? CATEGORIES.find(c => c.id === pickTodo.categoryId) : null;
  const endPick   = useCallback(() => router.setParams({ pick: '' }), [router]);

  const { selectedDate, setSelectedDate, countMode, setCountMode, wakeMinute, sleepMinute, defaultDuration } =
    useSettingsStore(s => ({
      selectedDate:    s.selectedDate,
      setSelectedDate: s.setSelectedDate,
      countMode:       s.countMode,
      setCountMode:    s.setCountMode,
      wakeMinute:      s.wakeMinute,
      sleepMinute:     s.sleepMinute,
      defaultDuration: s.defaultDuration,
    }));

  const [selEv,       setSelEv]       = useState<CalendarEvent | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [newStart,    setNewStart]    = useState(0);
  const [undoEntry,   setUndoEntry]   = useState<UndoEntry | null>(null);

  const ac        = countMode === 'down' ? C.cyan : C.amber;
  // Plain blocks on this date plus that date's virtual repeat occurrences.
  const dayEvents = useMemo(() => eventsOnDate(events, selectedDate), [events, selectedDate]);
  const todayFlag = isToday(selectedDate);

  const totalScheduled = dayEvents.reduce((s, e) => s + e.durationMinutes, 0);
  const freeTime       = Math.max(0, (sleepMinute - wakeMinute) - totalScheduled);
  const displayNum     = countMode === 'down' ? MINUTES_IN_DAY - currentMinute : currentMinute;
  const dayPct         = Math.round((currentMinute / MINUTES_IN_DAY) * 100);
  const progressPct    = countMode === 'down' ? 100 - dayPct : dayPct;

  const nextEvent = todayFlag
    ? dayEvents
        .filter(e => e.startMinute > currentMinute)
        .sort((a, b) => a.startMinute - b.startMinute)[0] ?? null
    : null;
  const minsUntilNext = nextEvent ? nextEvent.startMinute - currentMinute : null;
  const nextCat       = nextEvent ? CATEGORIES.find(c => c.id === nextEvent.categoryId) : null;

  const allDatesWithEvents = useMemo(() => {
    const t = today();
    return datesWithEvents(events, dateAddDays(t, -STRIP_RANGE_DAYS), dateAddDays(t, STRIP_RANGE_DAYS));
  }, [events]);

  const handleLongPress = useCallback((startMinute: number) => {
    if (pickTodo) {
      placeTodo(pickTodo, selectedDate, startMinute);
      endPick();
      return;
    }
    setNewStart(startMinute);
    setSelEv(null);
    setShowModal(true);
  }, [pickTodo, selectedDate, endPick]);

  const handleAddEvents = (newEvents: CalendarEvent[]) => {
    addEvents(newEvents);
  };

  const handleDeleteEvent = (id: string, scope: SeriesScope) => {
    const ev = dayEvents.find(e => e.id === id) ?? events.find(e => e.id === id);
    if (!ev) return;

    const occ  = parseOccurrenceId(id);
    const base = occ ? findSeries(events, occ.seriesId) : undefined;
    let restore: () => void;

    if (occ && base) {
      if (scope === 'one') {
        restore = () => restoreOccurrence(id);
      } else if (scope === 'future') {
        // Either the rule got an endDate, or the series vanished entirely
        // (the occurrence was its first) — check which at undo time.
        restore = () => {
          const store = useCalendarStore.getState();
          if (findSeries(store.events, occ.seriesId)) store.updateSeries(occ.seriesId, { repeat: base.repeat });
          else store.addEvent(base);
        };
      } else {
        restore = () => useCalendarStore.getState().addEvent(base);
      }
    } else {
      const linkedTodoId = todos.find(t => t.linkedEventId === id)?.id ?? null;
      restore = () => {
        addEvents([ev]);
        if (linkedTodoId) useTodoStore.getState().linkEventToTodo(linkedTodoId, ev.id);
      };
    }

    deleteWithScope(id, scope);
    setSelEv(null);

    if (undoEntry?.timer) clearTimeout(undoEntry.timer);
    const timer = setTimeout(() => setUndoEntry(null), 4000);
    const title = scope === 'all' ? `${ev.title} (series)` : scope === 'future' ? `${ev.title} (and future)` : ev.title;
    setUndoEntry({ title, restore, timer });
  };

  const handleUndo = () => {
    if (!undoEntry) return;
    clearTimeout(undoEntry.timer);
    undoEntry.restore();
    setUndoEntry(null);
  };

  // Swipe left → next day, swipe right → prev day.
  // failOffsetY keeps vertical scrolling inside DayGrid working normally.
  const handleSwipe = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state !== State.END) return;
    const { translationX, translationY } = e.nativeEvent;
    if (Math.abs(translationX) < 60 || Math.abs(translationX) < Math.abs(translationY)) return;
    setSelectedDate(dateAddDays(selectedDate, translationX < 0 ? 1 : -1));
  }, [selectedDate, setSelectedDate]);

  return (
    <View style={s.root}>
      {/* Date strip */}
      <DateStrip
        selectedDate={selectedDate}
        datesWithEvents={allDatesWithEvents}
        onSelect={setSelectedDate}
        accentColor={ac}
      />

      {/* Day summary bar */}
      <View style={s.summaryBar}>

        {/* Master counter */}
        <View style={s.counter}>
          <Text style={s.counterMode}>{countMode === 'down' ? 'CNTDN' : 'CNTUP'}</Text>
          <View style={s.counterRow}>
            <Text style={[s.counterNum, { color: ac }]}>
              {String(displayNum).padStart(4, '0')}
            </Text>
            <Text style={s.counterUnit}>{countMode === 'down' ? 'm↓' : 'm↑'}</Text>
          </View>
          <Text style={s.counterClock}>{minuteToTimeStr(currentMinute)}</Text>
        </View>

        {/* Progress + stats */}
        <View style={s.middle}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: ac }]} />
          </View>
          <View style={s.statsRow}>
            <Text style={s.stat}>
              <Text style={[s.statNum, { color: ac }]}>{totalScheduled}</Text>m sched
            </Text>
            <Text style={s.stat}>
              <Text style={s.statNum}>{freeTime}</Text>m free
            </Text>
            <Text style={s.stat}>
              <Text style={s.statNum}>{dayEvents.length}</Text> blk
            </Text>
          </View>
        </View>

        {/* Mode toggle + settings */}
        <View style={s.controls}>
          <View style={s.modeToggle}>
            <Pressable
              style={[s.modeBtn, countMode === 'up' && { backgroundColor: `${C.amber}22` }]}
              onPress={() => setCountMode('up')}
            >
              <Text style={[s.modeTxt, countMode === 'up' && { color: C.amber, fontWeight: '700' }]}>▲</Text>
            </Pressable>
            <Pressable
              style={[s.modeBtn, countMode === 'down' && { backgroundColor: `${C.cyan}22` }]}
              onPress={() => setCountMode('down')}
            >
              <Text style={[s.modeTxt, countMode === 'down' && { color: C.cyan, fontWeight: '700' }]}>▼</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/settings')}>
            <Text style={s.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

      </View>

      {/* Placement banner (Tasks → PICK): long-press a slot to place the todo there */}
      {pickTodo && (
        <View style={[s.pickBar, { borderLeftColor: pickCat?.color ?? ac }]}>
          <View style={s.pickBody}>
            <Text style={s.pickLabel}>PLACING · LONG-PRESS A FREE SLOT</Text>
            <Text style={s.pickText} numberOfLines={1}>
              <Text style={[s.pickTitle, { color: pickCat?.color ?? C.L1 }]}>{pickTodo.title}</Text>
              <Text style={s.pickMeta}>{'  '}{pickTodo.durationMinutes}m · {pickCat?.label}</Text>
            </Text>
          </View>
          <Pressable onPress={endPick} hitSlop={10} style={s.pickCancel}>
            <Text style={[s.pickCancelText, { color: ac }]}>CANCEL</Text>
          </Pressable>
        </View>
      )}

      {/* Next-block countdown banner (today only, when a future block exists) */}
      {nextEvent && minsUntilNext !== null && (
        <View style={[s.nextBar, { borderLeftColor: nextCat?.color ?? ac }]}>
          <Text style={s.nextText} numberOfLines={1}>
            <Text style={[s.nextMin, { color: ac }]}>in {minsUntilNext}m</Text>
            {'  ·  '}
            <Text style={[s.nextTitle, { color: nextCat?.color ?? C.L1 }]}>{nextEvent.title}</Text>
            <Text style={s.nextTime}>{'  '}{minuteToTimeStr(nextEvent.startMinute)}</Text>
          </Text>
        </View>
      )}

      {/* Timeline — wrapped in a gesture handler for left/right date swiping.
          activeOffsetX requires 45px horizontal movement before activating.
          failOffsetY yields to vertical scroll if 15px vertical detected first. */}
      <PanGestureHandler
        onHandlerStateChange={handleSwipe}
        activeOffsetX={[-45, 45]}
        failOffsetY={[-15, 15]}
      >
        <View style={{ flex: 1 }}>
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
            onUpdateEvent={updateEvent}
          />
        </View>
      </PanGestureHandler>

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
          onUpdateSeries={updateSeries}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Undo toast */}
      {undoEntry && (
        <View style={s.toast}>
          <Text style={s.toastText} numberOfLines={1}>
            Deleted "{undoEntry.title}"
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: C.bg1, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  counter:      { flexShrink: 0 },
  counterMode:  { fontSize: 6, color: C.L4, letterSpacing: 1.5, marginBottom: 1 },
  counterRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  counterNum:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  counterUnit:  { fontSize: 7, color: C.L3 },
  counterClock: { fontSize: 7, color: C.L2, marginTop: 1 },
  middle:       { flex: 1, gap: 4 },
  progressBg:   { height: 3, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  statsRow:     { flexDirection: 'row', gap: 8 },
  stat:         { fontSize: 8, color: C.L3 },
  statNum:      { fontSize: 9, fontWeight: '700', color: C.L2 },
  controls:     { flexShrink: 0, alignItems: 'flex-end', gap: 4 },
  modeToggle:   { flexDirection: 'row', borderRadius: 3, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  modeBtn:      { paddingHorizontal: 6, paddingVertical: 3 },
  modeTxt:      { fontSize: 9, color: C.L3 },
  settingsIcon: { fontSize: 13, color: C.L3, padding: 2 },
  nextBar: {
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: C.bg1,
    borderLeftWidth: 3,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  nextText:  { fontSize: 10, color: C.L2 },
  nextMin:   { fontWeight: '900' },
  nextTitle: { fontWeight: '700' },
  nextTime:  { color: C.L3, fontSize: 9 },
  pickBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.bg2,
    borderLeftWidth: 3,
    borderBottomWidth: 1, borderBottomColor: C.borderHi,
  },
  pickBody:       { flex: 1, minWidth: 0 },
  pickLabel:      { fontSize: 7, color: C.L3, letterSpacing: 1.5, marginBottom: 2 },
  pickText:       { fontSize: 11, color: C.L2 },
  pickTitle:      { fontWeight: '700' },
  pickMeta:       { color: C.L3, fontSize: 9 },
  pickCancel:     { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3, borderWidth: 1, borderColor: C.border },
  pickCancelText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
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
