import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DESIGN_TOKENS as C, today } from '@1440/core';

// One month of day cells with ‹ › navigation. Shared by the Day screen's date
// strip (expanded state) and the block modal's date fields, so there is one
// calendar picker in the app rather than a native dependency.

const DOW    = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

interface Props {
  selectedDate:     string;
  datesWithEvents?: Iterable<string>;
  accentColor?:     string;
  onSelect:         (date: string) => void;
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthOf(date: string) {
  const d = new Date(date + 'T12:00:00');
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default function MonthGrid({ selectedDate, datesWithEvents, accentColor = C.amber, onSelect }: Props) {
  const todayStr = useMemo(() => today(), []);
  const evSet    = useMemo(() => new Set(datesWithEvents ?? []), [datesWithEvents]);
  const [gridMonth, setGridMonth] = useState(() => monthOf(selectedDate));

  // Follow the selection (a swipe on the Day screen, a pick elsewhere).
  useEffect(() => { setGridMonth(monthOf(selectedDate)); }, [selectedDate]);

  const prevMonth = useCallback(() =>
    setGridMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    ), []);
  const nextMonth = useCallback(() =>
    setGridMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    ), []);

  const cells = useMemo(
    () => buildMonthCells(gridMonth.year, gridMonth.month),
    [gridMonth.year, gridMonth.month],
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={prevMonth} hitSlop={10}>
          <Text style={s.nav}>‹</Text>
        </Pressable>
        <Text style={s.title}>{MONTHS[gridMonth.month]} {gridMonth.year}</Text>
        <Pressable onPress={nextMonth} hitSlop={10}>
          <Text style={s.nav}>›</Text>
        </Pressable>
      </View>

      <View style={s.row}>
        {DOW.map((d, i) => <Text key={i} style={s.dow}>{d}</Text>)}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={s.row}>
          {cells.slice(row * 7, row * 7 + 7).map((date, col) => {
            if (!date) return <View key={col} style={s.cell} />;
            const active = date === selectedDate;
            const isT    = date === todayStr;
            const hasEvs = evSet.has(date);
            return (
              <Pressable
                key={col}
                style={[s.cell, active && { backgroundColor: `${accentColor}33`, borderRadius: 4 }]}
                onPress={() => onSelect(date)}
              >
                <Text style={[
                  s.num,
                  isT    && { color: accentColor },
                  active && { color: accentColor, fontWeight: '900' },
                ]}>
                  {Number(date.slice(8))}
                </Text>
                {(hasEvs || isT) && (
                  <View style={[s.dot, { backgroundColor: active ? accentColor : C.L3 }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { paddingHorizontal: 6, paddingBottom: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 8,
  },
  title:  { fontSize: 10, color: C.L2, fontWeight: '700', letterSpacing: 0.5 },
  nav:    { fontSize: 18, color: C.L3, paddingHorizontal: 6 },
  row:    { flexDirection: 'row' },
  dow:    { flex: 1, textAlign: 'center', fontSize: 8, color: C.L3, fontWeight: '600', paddingVertical: 4 },
  cell:   { flex: 1, alignItems: 'center', paddingVertical: 5 },
  num:    { fontSize: 11, color: C.L2, fontWeight: '600' },
  dot:    { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
});
