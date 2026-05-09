import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet,
  Platform, UIManager, LayoutAnimation,
} from 'react-native';
import { DESIGN_TOKENS as C, dateAddDays, formatDateDisplay, today } from '@1440/core';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DOW    = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const ITEM_W  = 48;
const RANGE   = 365;
const TOTAL   = RANGE * 2 + 1; // 731 days, today is at index RANGE
const MID_IDX = RANGE;

interface Props {
  selectedDate:    string;
  datesWithEvents: string[];
  onSelect:        (date: string) => void;
  accentColor?:    string;
}

function buildDays(todayStr: string): { date: string }[] {
  return Array.from({ length: TOTAL }, (_, i) => ({
    date: dateAddDays(todayStr, i - MID_IDX),
  }));
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function idxForDate(todayStr: string, date: string): number {
  const t = new Date(todayStr + 'T12:00:00').getTime();
  const d = new Date(date    + 'T12:00:00').getTime();
  return MID_IDX + Math.round((d - t) / 86400000);
}

export default function DateStrip({ selectedDate, datesWithEvents, onSelect, accentColor = C.amber }: Props) {
  const listRef   = useRef<FlatList>(null);
  const didInit   = useRef(false);
  const todayStr  = useMemo(() => today(), []);
  const evSet     = useMemo(() => new Set(datesWithEvents), [datesWithEvents]);
  const days      = useMemo(() => buildDays(todayStr), [todayStr]);

  const [expanded,  setExpanded]  = useState(false);
  const [gridMonth, setGridMonth] = useState(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const scrollTo = useCallback((date: string, animated: boolean) => {
    const idx = Math.max(0, Math.min(TOTAL - 1, idxForDate(todayStr, date)));
    listRef.current?.scrollToIndex({ index: idx, animated, viewPosition: 0.5 });
  }, [todayStr]);

  // Scroll strip to selected date whenever it changes
  useEffect(() => {
    scrollTo(selectedDate, true);
    const d = new Date(selectedDate + 'T12:00:00');
    setGridMonth({ year: d.getFullYear(), month: d.getMonth() });
  }, [selectedDate]);

  // One-time initial centering (no animation so it snaps immediately)
  const handleLayout = useCallback(() => {
    if (didInit.current) return;
    didInit.current = true;
    scrollTo(selectedDate, false);
  }, [selectedDate, scrollTo]);

  const goToToday = useCallback(() => onSelect(todayStr), [todayStr, onSelect]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  }, []);

  const prevMonth = useCallback(() =>
    setGridMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    ), []);

  const nextMonth = useCallback(() =>
    setGridMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    ), []);

  const monthCells = useMemo(
    () => buildMonthCells(gridMonth.year, gridMonth.month),
    [gridMonth.year, gridMonth.month],
  );

  const renderItem = useCallback(({ item }: { item: { date: string } }) => {
    const dt      = new Date(item.date + 'T12:00:00');
    const active  = item.date === selectedDate;
    const isT     = item.date === todayStr;
    const hasEvs  = evSet.has(item.date);
    return (
      <Pressable
        style={[s.dayItem, active && { backgroundColor: `${accentColor}22` }]}
        onPress={() => onSelect(item.date)}
      >
        <Text style={[s.dow, active && { color: C.L1 }]}>{DOW[dt.getDay()]}</Text>
        <Text style={[
          s.dayNum,
          isT   && { color: accentColor },
          active && { color: accentColor, fontWeight: '900' },
        ]}>
          {dt.getDate()}
        </Text>
        <View style={[
          s.dot,
          (hasEvs || isT) && { backgroundColor: active ? accentColor : C.L3 },
        ]} />
      </Pressable>
    );
  }, [selectedDate, todayStr, accentColor, onSelect, evSet]);

  const getItemLayout = useCallback((_: any, i: number) => ({
    length: ITEM_W, offset: ITEM_W * i, index: i,
  }), []);

  const isNotToday = selectedDate !== todayStr;

  return (
    <View style={s.root}>

      {/* Horizontal date strip */}
      <View style={s.stripRow}>
        <FlatList
          ref={listRef}
          data={days}
          keyExtractor={d => d.date}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialScrollIndex={MID_IDX}
          onLayout={handleLayout}
          onScrollToIndexFailed={info => {
            // Fallback: scroll by pixel offset if index-based scroll fails
            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: info.index * ITEM_W,
                animated: false,
              });
            }, 50);
          }}
          extraData={[selectedDate, accentColor, evSet]}
          removeClippedSubviews
          style={s.list}
        />
        {isNotToday && (
          <Pressable
            style={[s.todayBtn, { borderColor: accentColor }]}
            onPress={goToToday}
            hitSlop={6}
          >
            <Text style={[s.todayTxt, { color: accentColor }]}>TODAY</Text>
          </Pressable>
        )}
      </View>

      {/* Full date label + expand chevron */}
      <Pressable style={s.dateRow} onPress={toggleExpanded}>
        <Text style={s.fullDate}>{formatDateDisplay(selectedDate)}</Text>
        <Text style={[s.chevron, { color: accentColor }]}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {/* Month grid (expanded) */}
      {expanded && (
        <View style={s.monthGrid}>

          {/* Month nav header */}
          <View style={s.monthHeader}>
            <Pressable onPress={prevMonth} hitSlop={10}>
              <Text style={s.monthNav}>‹</Text>
            </Pressable>
            <Text style={s.monthTitle}>
              {MONTHS[gridMonth.month]} {gridMonth.year}
            </Text>
            <Pressable onPress={nextMonth} hitSlop={10}>
              <Text style={s.monthNav}>›</Text>
            </Pressable>
          </View>

          {/* Day-of-week column headers */}
          <View style={s.gridRow}>
            {DOW.map((d, i) => (
              <Text key={i} style={s.gridDow}>{d}</Text>
            ))}
          </View>

          {/* Calendar rows */}
          {Array.from({ length: monthCells.length / 7 }, (_, row) => (
            <View key={row} style={s.gridRow}>
              {monthCells.slice(row * 7, row * 7 + 7).map((date, col) => {
                if (!date) return <View key={col} style={s.gridCell} />;
                const active = date === selectedDate;
                const isT    = date === todayStr;
                const hasEvs = evSet.has(date);
                const dt     = new Date(date + 'T12:00:00');
                return (
                  <Pressable
                    key={col}
                    style={[
                      s.gridCell,
                      active && { backgroundColor: `${accentColor}33`, borderRadius: 4 },
                    ]}
                    onPress={() => { onSelect(date); toggleExpanded(); }}
                  >
                    <Text style={[
                      s.gridNum,
                      isT    && { color: accentColor },
                      active && { color: accentColor, fontWeight: '900' },
                    ]}>
                      {dt.getDate()}
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
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { backgroundColor: C.bg1, borderBottomWidth: 1, borderBottomColor: C.border },
  stripRow: { flexDirection: 'row', alignItems: 'center' },
  list:     { flex: 1 },
  dayItem:  { width: ITEM_W, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  dow:      { fontSize: 9, color: C.L3, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  dayNum:   { fontSize: 15, color: C.L3, fontWeight: '700' },
  dot:      { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  todayBtn: {
    marginRight: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1,
  },
  todayTxt: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 3,
  },
  fullDate: { fontSize: 9, color: C.L3, letterSpacing: 1.5 },
  chevron:  { fontSize: 8, marginLeft: 6 },

  monthGrid: { paddingHorizontal: 6, paddingBottom: 8, borderTopWidth: 1, borderTopColor: C.border },
  monthHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 8,
  },
  monthTitle: { fontSize: 10, color: C.L2, fontWeight: '700', letterSpacing: 0.5 },
  monthNav:   { fontSize: 18, color: C.L3, paddingHorizontal: 6 },
  gridRow:    { flexDirection: 'row' },
  gridDow:    { flex: 1, textAlign: 'center', fontSize: 8, color: C.L3, fontWeight: '600', paddingVertical: 4 },
  gridCell:   { flex: 1, alignItems: 'center', paddingVertical: 5 },
  gridNum:    { fontSize: 11, color: C.L2, fontWeight: '600' },
});
