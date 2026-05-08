import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { DESIGN_TOKENS as C, dateAddDays, formatDateDisplay, isToday } from '@1440/core';

interface DayItem {
  date:       string;
  hasEvents:  boolean;
}

interface Props {
  selectedDate:   string;
  datesWithEvents: string[];
  onSelect:       (date: string) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ITEM_WIDTH = 48;
const CENTER_INDEX = 3; // today is index 3 in the 7-day window

function buildDays(anchor: string, datesWithEvents: Set<string>): DayItem[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = dateAddDays(anchor, i - CENTER_INDEX);
    return { date, hasEvents: datesWithEvents.has(date) };
  });
}

export default function DateStrip({ selectedDate, datesWithEvents, onSelect }: Props) {
  const evSet  = new Set(datesWithEvents);
  const days   = buildDays(selectedDate, evSet);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    listRef.current?.scrollToIndex({ index: CENTER_INDEX, animated: true });
  }, [selectedDate]);

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index,
  });

  const renderItem = ({ item }: { item: DayItem }) => {
    const dt      = new Date(item.date + 'T12:00:00');
    const dow     = DAYS[dt.getDay()];
    const dayNum  = dt.getDate();
    const active  = item.date === selectedDate;
    const todayEl = isToday(item.date);

    return (
      <Pressable style={[s.dayItem, active && s.dayItemActive]} onPress={() => onSelect(item.date)}>
        <Text style={[s.dow, active && { color: C.L1 }]}>{dow}</Text>
        <Text style={[s.dayNum, active && { color: C.amber }, todayEl && !active && { color: C.L2 }]}>
          {dayNum}
        </Text>
        <View style={[s.dot, item.hasEvents && s.dotVisible, active && { backgroundColor: C.amber }]} />
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      <FlatList
        ref={listRef}
        data={days}
        keyExtractor={d => d.date}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        contentContainerStyle={s.list}
        initialScrollIndex={CENTER_INDEX}
      />
      <Text style={s.fullDate}>{formatDateDisplay(selectedDate)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { backgroundColor: C.bg1, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  list:          { paddingHorizontal: 8 },
  dayItem:       { width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  dayItemActive: { backgroundColor: 'rgba(245,158,11,0.12)' },
  dow:           { fontSize: 9, color: C.L3, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  dayNum:        { fontSize: 15, color: C.L3, fontWeight: '700' },
  dot:           { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  dotVisible:    { backgroundColor: C.L3 },
  fullDate: {
    textAlign: 'center', fontSize: 9, color: C.L3,
    letterSpacing: 1.5, paddingTop: 2, paddingBottom: 2,
  },
});
