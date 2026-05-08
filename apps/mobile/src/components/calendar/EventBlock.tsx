import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, DESIGN_TOKENS as C, PPM, RULER_W } from '@1440/core';
import type { CalendarEvent, EventLayoutSlot } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';

interface Props {
  event:    CalendarEvent;
  layout:   EventLayoutSlot;
  selected: boolean;
  onSelect: (event: CalendarEvent) => void;
}

const RIGHT_PAD = 8;

export default function EventBlock({ event, layout, selected, onSelect }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  if (!event) return null;
  const cat = CATEGORIES.find(c => c.id === event.categoryId);

  const { column = 0, totalColumns = 1 } = layout;
  const availableWidth = screenWidth - RULER_W - RIGHT_PAD;
  const slotWidth      = availableWidth / totalColumns;
  const leftPos        = RULER_W + column * slotWidth + (column > 0 ? 2 : 0);
  const blockWidth     = slotWidth - (column > 0 ? 2 : 0);

  const top    = event.startMinute * PPM;
  const height = Math.max(event.durationMinutes * PPM, 24);

  return (
    <Pressable
      style={[
        s.block,
        {
          top, height,
          left:   leftPos,
          width:  blockWidth,
          backgroundColor: cat?.bg ?? 'rgba(255,255,255,0.08)',
          borderLeftColor: cat?.color ?? '#fff',
          borderColor:     selected ? cat?.color : 'transparent',
          shadowColor:     selected ? cat?.color : undefined,
          shadowOpacity:   selected ? 0.5 : 0,
          zIndex:          selected ? 10 : 2,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(event);
      }}
    >
      <View style={s.titleRow}>
        <View style={[s.dot, { backgroundColor: cat?.color }]} />
        <Text style={s.title} numberOfLines={1}>{event.title}</Text>
        {event.fromTodo && <Text style={[s.badge, { color: cat?.color }]}>☑</Text>}
        {event.seriesId && <Text style={[s.badge, { color: C.L3 }]}>↺</Text>}
      </View>
      {height > 32 && (
        <Text style={s.timeLabel}>
          {minuteToTimeStr(event.startMinute)} · {event.durationMinutes}m
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  block: {
    position:      'absolute',
    borderLeftWidth: 3,
    borderWidth:   1.5,
    borderRadius:  6,
    paddingLeft:   6, paddingRight: 5,
    paddingTop:    3, paddingBottom: 3,
    overflow:      'hidden',
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  8,
    elevation:     2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:      { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  title: {
    color: C.L1, fontSize: 10, fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }), flex: 1,
  },
  badge:     { fontSize: 8, flexShrink: 0 },
  timeLabel: {
    color: C.L2, fontSize: 8, marginTop: 1,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
  },
});
