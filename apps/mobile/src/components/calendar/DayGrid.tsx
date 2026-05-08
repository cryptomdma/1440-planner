import React, { useRef, useEffect } from 'react';
import {
  View, ScrollView, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import {
  DESIGN_TOKENS as C, PPM, MINUTES_IN_DAY, BLOCK_SIZE, RULER_W,
  computeLayout, minuteToTimeStr,
} from '@1440/core';
import type { CalendarEvent } from '@1440/core';
import EventBlock from './EventBlock';
import TimelineRuler from './TimelineRuler';

interface Props {
  events:        CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  currentMinute: number;
  countMode:     'up' | 'down';
  accentColor:   string;
  wakeMinute:    number;
  sleepMinute:   number;
  isToday:       boolean;
  onSelectEvent: (ev: CalendarEvent) => void;
  onLongPress:   (startMinute: number) => void;
}

const TOTAL_HEIGHT = MINUTES_IN_DAY * PPM;

export default function DayGrid({
  events, selectedEvent, currentMinute, countMode, accentColor,
  wakeMinute, sleepMinute, isToday, onSelectEvent, onLongPress,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const layout    = computeLayout(events);

  // Auto-scroll to NOW line on mount / day change
  useEffect(() => {
    if (!isToday) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, currentMinute * PPM - 250), animated: true });
    }, 200);
    return () => clearTimeout(timer);
  }, [isToday]);

  const handleLongPress = (e: any) => {
    const y   = e.nativeEvent.locationY;
    const min = Math.max(0, Math.min(MINUTES_IN_DAY - BLOCK_SIZE, Math.round(y / PPM / BLOCK_SIZE) * BLOCK_SIZE));
    onLongPress(min);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.scroll}
      contentContainerStyle={{ height: TOTAL_HEIGHT }}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
    >
      <Pressable
        style={[s.inner, { height: TOTAL_HEIGHT }]}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        {/* Wake/sleep shading */}
        <View style={[s.shade, { top: 0, height: wakeMinute * PPM }]} />
        <View style={[s.shade, { top: sleepMinute * PPM, height: (MINUTES_IN_DAY - sleepMinute) * PPM }]} />

        {/* Ruler + grid lines */}
        <TimelineRuler countMode={countMode} />

        {/* NOW indicator (today only) */}
        {isToday && (
          <View style={[s.nowRow, { top: currentMinute * PPM }]} pointerEvents="none">
            <View style={[s.nowDot, { backgroundColor: accentColor }]} />
            <View style={[s.nowLine, { backgroundColor: accentColor }]} />
            <Text style={[s.nowLabel, { color: accentColor }]}>
              {countMode === 'down'
                ? `${MINUTES_IN_DAY - currentMinute}`
                : minuteToTimeStr(currentMinute)}
            </Text>
          </View>
        )}

        {/* Event blocks */}
        {events.map(ev => (
          <EventBlock
            key={ev.id}
            event={ev}
            layout={layout[ev.id] ?? { column: 0, totalColumns: 1 }}
            selected={selectedEvent?.id === ev.id}
            onSelect={onSelectEvent}
          />
        ))}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  inner:  { position: 'relative' },
  shade:  {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  nowRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', height: 2,
    zIndex: 20,
  },
  nowDot:  { width: 8, height: 8, borderRadius: 4, marginLeft: RULER_W - 4 },
  nowLine: { flex: 1, height: 1.5, opacity: 0.7 },
  nowLabel: {
    fontSize: 8, fontWeight: '700', marginLeft: 4,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
  },
});
