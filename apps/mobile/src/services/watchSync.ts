import { Platform } from 'react-native';
import type { CalendarEvent } from '@1440/core';
import { CATEGORIES } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';

export interface WatchSnapshot {
  version:      number;
  date:         string;
  currentMinute: number;
  countMode:    'up' | 'down';
  wakeMinute:   number;
  sleepMinute:  number;
  events: Array<{
    startMinute:    number;
    durationMinutes: number;
    categoryId:     string;
    color:          string;
  }>;
  currentBlock?: { title: string; endsAt: number };
  nextBlock?:    { title: string; startsAt: number; timeStr: string };
}

export function buildWatchSnapshot(params: {
  events:       CalendarEvent[];
  date:         string;
  currentMinute: number;
  countMode:    'up' | 'down';
  wakeMinute:   number;
  sleepMinute:  number;
}): WatchSnapshot {
  const { events, date, currentMinute, countMode, wakeMinute, sleepMinute } = params;

  const dayEvents = events.filter(e => e.date === date);

  const currentBlock = dayEvents.find(
    e => e.startMinute <= currentMinute && e.startMinute + e.durationMinutes > currentMinute
  );
  const nextBlock = dayEvents
    .filter(e => e.startMinute > currentMinute)
    .sort((a, b) => a.startMinute - b.startMinute)[0];

  return {
    version:       1,
    date,
    currentMinute,
    countMode,
    wakeMinute,
    sleepMinute,
    events: dayEvents.map(e => ({
      startMinute:    e.startMinute,
      durationMinutes: e.durationMinutes,
      categoryId:     e.categoryId,
      color:          CATEGORIES.find(c => c.id === e.categoryId)?.color ?? '#888',
    })),
    currentBlock: currentBlock
      ? { title: currentBlock.title, endsAt: currentBlock.startMinute + currentBlock.durationMinutes }
      : undefined,
    nextBlock: nextBlock
      ? { title: nextBlock.title, startsAt: nextBlock.startMinute, timeStr: minuteToTimeStr(nextBlock.startMinute) }
      : undefined,
  };
}

// Platform-branched sync. Stubs log during development; real bridges wired in Phase 6.
export async function syncToWatch(snapshot: WatchSnapshot): Promise<void> {
  if (Platform.OS === 'android') {
    return syncAndroid(snapshot);
  } else if (Platform.OS === 'ios') {
    return syncIOS(snapshot);
  }
}

async function syncAndroid(snapshot: WatchSnapshot): Promise<void> {
  // TODO Phase 6: call WearableDataLayerModule.sendSnapshot(JSON.stringify(snapshot))
  if (__DEV__) console.log('[watchSync:android]', snapshot.currentMinute, 'min');
}

async function syncIOS(snapshot: WatchSnapshot): Promise<void> {
  // TODO Phase 6: call WatchConnectivityModule.sendMessage({ snapshot: JSON.stringify(snapshot) })
  if (__DEV__) console.log('[watchSync:ios]', snapshot.currentMinute, 'min');
}
