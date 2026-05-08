import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import {
  DESIGN_TOKENS as C, CATEGORIES,
  useCalendarStore, useSettingsStore,
  useCurrentMinute, minuteToTimeStr, formatDuration,
} from '@1440/core';
import type { CalendarEvent } from '@1440/core';
import WatchCanvas from '../components/watchface/WatchCanvas';
import BlockModal  from '../components/ui/BlockModal';

export default function WatchScreen() {
  const currentMinute = useCurrentMinute();

  const events    = useCalendarStore(s => s.events);
  const updateEvent = useCalendarStore(s => s.updateEvent);
  const deleteEvent = useCalendarStore(s => s.deleteEvent);

  const { selectedDate, countMode } = useSettingsStore(s => ({
    selectedDate: s.selectedDate,
    countMode:    s.countMode,
  }));

  const [selEv, setSelEv] = useState<CalendarEvent | null>(null);

  const ac         = countMode === 'down' ? C.cyan : C.amber;
  const dayEvents  = events.filter(e => e.date === selectedDate);
  const sortedEvs  = [...dayEvents].sort((a, b) => a.startMinute - b.startMinute);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Watch face SVG */}
        <View style={s.watchWrap}>
          <WatchCanvas
            currentMinute={currentMinute}
            events={dayEvents}
            countMode={countMode}
          />
        </View>

        {/* Event list */}
        <View style={s.list}>
          {sortedEvs.length === 0 ? (
            <Text style={s.empty}>No blocks scheduled</Text>
          ) : (
            sortedEvs.map(ev => {
              const cat    = CATEGORIES.find(c => c.id === ev.categoryId);
              const isNow  = ev.startMinute <= currentMinute && ev.startMinute + ev.durationMinutes > currentMinute;
              return (
                <Pressable
                  key={ev.id}
                  style={[s.evRow, isNow && { borderLeftColor: ac, borderLeftWidth: 3 }]}
                  onPress={() => setSelEv(ev)}
                >
                  <View style={[s.evDot, { backgroundColor: cat?.color }]} />
                  <View style={s.evInfo}>
                    <Text style={[s.evTitle, isNow && { color: C.L1 }]} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    <Text style={s.evTime}>
                      {minuteToTimeStr(ev.startMinute)} · {formatDuration(ev.durationMinutes)}
                    </Text>
                  </View>
                  {isNow && (
                    <View style={[s.nowBadge, { backgroundColor: `${ac}22`, borderColor: ac }]}>
                      <Text style={[s.nowBadgeText, { color: ac }]}>NOW</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Edit sheet */}
      {selEv && (
        <BlockModal
          mode="edit"
          visible={!!selEv}
          onClose={() => setSelEv(null)}
          event={selEv}
          accentColor={ac}
          onUpdate={updateEvent}
          onDelete={id => { deleteEvent(id); setSelEv(null); }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg0 },
  content:  { alignItems: 'center', paddingBottom: 30 },
  watchWrap: { paddingVertical: 20 },
  list:     { width: '100%', paddingHorizontal: 16 },
  empty:    { color: C.L3, fontSize: 11, textAlign: 'center', marginTop: 20 },
  evRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderLeftWidth: 0,
  },
  evDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  evInfo:   { flex: 1 },
  evTitle:  { fontSize: 12, color: C.L2, fontWeight: '600', marginBottom: 2 },
  evTime:   { fontSize: 9, color: C.L3 },
  nowBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 3, borderWidth: 1,
  },
  nowBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
});
