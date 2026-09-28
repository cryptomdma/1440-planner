import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CATEGORIES, DESIGN_TOKENS as C,
  useCalendarStore, useSettingsStore, useCurrentMinute,
  eventsInRange, isSeries, describeRepeat,
  today, dateAddDays, formatDateDisplay, isToday,
  minuteToTimeStr, formatDuration,
} from '@1440/core';
import type { CalendarEvent } from '@1440/core';

// The agenda is bounded by the *view*, never by the rule: a "forever" series
// expands to exactly as many days as are on screen. The window starts at 14
// days and SHOW MORE extends it by another 14 each time — day.tsx already
// expands ±365 for the strip dots, so even a long window is cheap.
const WINDOW_DAYS = 14;

interface DaySection {
  date:  string;
  data:  CalendarEvent[];
  total: number;   // scheduled minutes that day
}

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  a.date < b.date ? -1 : a.date > b.date ? 1
  : a.startMinute - b.startMinute || a.title.localeCompare(b.title);

export default function ScheduleList() {
  const router = useRouter();
  const events          = useCalendarStore(s => s.events);
  const setSelectedDate = useSettingsStore(s => s.setSelectedDate);
  const countMode       = useSettingsStore(s => s.countMode);
  const ac = countMode === 'down' ? C.cyan : C.amber;

  // Re-renders every 30 s: the "now" highlight moves, and `todayStr` (hence
  // the whole window) rolls over at midnight.
  const currentMinute = useCurrentMinute();
  const todayStr = useMemo(() => today(), [currentMinute]);

  const [days, setDays] = useState(WINDOW_DAYS);
  const from = todayStr;
  const to   = dateAddDays(todayStr, days - 1);

  // One expansion per render over the visible range. eventsInRange returns
  // virtual occurrences (ids `<seriesId>:<date>`) with their display date, so
  // grouping by `date` is already correct for moved occurrences.
  const sections: DaySection[] = useMemo(() => {
    const occ = eventsInRange(events, from, to).sort(byStart);
    const out: DaySection[] = [];
    for (const e of occ) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) {
        last.data.push(e);
        last.total += e.durationMinutes;
      } else {
        out.push({ date: e.date, data: [e], total: e.durationMinutes });
      }
    }
    return out;
  }, [events, from, to]);

  const blockCount = sections.reduce((n, sec) => n + sec.data.length, 0);

  // A row tap opens that day on the Day screen. The grid scrolls to "now" on
  // today and to midnight elsewhere on mount, so nothing more is needed here;
  // editing stays on Day (its undo / scope plumbing is not duplicated).
  const openDay = useCallback((e: CalendarEvent) => {
    setSelectedDate(e.date);
    router.push('/day');
  }, [setSelectedDate, router]);

  const header = (
    <View style={s.header}>
      <Text style={s.headerTitle}>SCHEDULE</Text>
      <Text style={s.headerSub}>
        {formatDateDisplay(from)} → {formatDateDisplay(to)} · {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
      </Text>
    </View>
  );

  const footer = (
    <View style={s.footer}>
      <Pressable style={s.moreBtn} onPress={() => setDays(d => d + WINDOW_DAYS)}>
        <Text style={s.moreText}>SHOW MORE · +{WINDOW_DAYS} DAYS</Text>
      </Pressable>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={e => e.id}
      contentContainerStyle={s.content}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <Text style={s.empty}>No blocks in the next {days} days.</Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={s.dayHeader}>
          <Text style={[s.dayTitle, isToday(section.date) && { color: ac }]}>
            {isToday(section.date) ? 'TODAY · ' : ''}{formatDateDisplay(section.date).toUpperCase()}
          </Text>
          <Text style={s.dayMeta}>
            {section.data.length} {section.data.length === 1 ? 'blk' : 'blks'} · {formatDuration(section.total)}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <ScheduleRow
          event={item}
          now={isToday(item.date) ? currentMinute : null}
          accent={ac}
          onPress={openDay}
        />
      )}
      stickySectionHeadersEnabled={false}
    />
  );
}

interface RowProps {
  event:   CalendarEvent;
  now:     number | null;   // current minute when the block is on today, else null
  accent:  string;
  onPress: (e: CalendarEvent) => void;
}

function ScheduleRow({ event, now, accent, onPress }: RowProps) {
  const cat     = CATEGORIES.find(c => c.id === event.categoryId);
  const end     = event.startMinute + event.durationMinutes;
  const current = now !== null && event.startMinute <= now && now < end;
  const past    = now !== null && end <= now;
  const series  = isSeries(event);

  return (
    <Pressable
      style={[
        s.row,
        { borderLeftColor: cat?.color ?? C.border },
        current && { borderColor: accent, backgroundColor: cat?.bg ?? C.bg3 },
        past && s.rowPast,
      ]}
      onPress={() => onPress(event)}
    >
      <View style={s.timeCol}>
        <Text style={[s.time, current && { color: accent }]}>{minuteToTimeStr(event.startMinute)}</Text>
        <Text style={s.dur}>{formatDuration(event.durationMinutes)}</Text>
      </View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{event.title}</Text>
        <View style={s.tags}>
          <Text style={[s.tag, { color: cat?.color, backgroundColor: cat?.bg }]}>{cat?.label}</Text>
          {current && <Text style={[s.nowTag, { color: accent, borderColor: accent }]}>NOW</Text>}
          {series && <Text style={s.metaTag}>↺ {describeRepeat(event.repeat)}</Text>}
          {event.fromTodo && <Text style={s.metaTag}>☑ from tasks</Text>}
        </View>
      </View>

      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content:     { padding: 14, paddingBottom: 24 },
  header:      { marginBottom: 4 },
  headerTitle: { fontSize: 10, color: C.L3, letterSpacing: 2, marginBottom: 6 },
  headerSub:   { fontSize: 9, color: C.L4, letterSpacing: 0.5 },

  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: 16, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4,
  },
  dayTitle: { fontSize: 9, color: C.L2, letterSpacing: 1.5, fontWeight: '700' },
  dayMeta:  { fontSize: 8, color: C.L4, letterSpacing: 1 },

  row: {
    backgroundColor: C.bg2,
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 3,
    borderRadius: 6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    padding: 10, marginBottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rowPast: { opacity: 0.5 },
  timeCol: { width: 62, flexShrink: 0 },
  time:    { fontSize: 11, color: C.L1, fontWeight: '700' },
  dur:     { fontSize: 9, color: C.L3, marginTop: 2 },
  body:    { flex: 1, minWidth: 0 },
  title: {
    fontSize: 12, color: C.L1, fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    marginBottom: 4,
  },
  tags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag:     { fontSize: 9, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  nowTag:  { fontSize: 8, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, borderWidth: 1 },
  metaTag: { fontSize: 9, color: C.L2 },
  chevron: { fontSize: 18, color: C.L4, paddingLeft: 2 },

  empty:   { fontSize: 10, color: C.L3, marginTop: 24, textAlign: 'center', letterSpacing: 0.5 },
  footer:  { marginTop: 14, alignItems: 'center' },
  moreBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 4, borderWidth: 1, borderColor: C.border },
  moreText: { fontSize: 9, color: C.L2, letterSpacing: 1 },
});
