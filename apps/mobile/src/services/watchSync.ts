import { Platform } from 'react-native';
import type { CalendarEvent } from '@1440/core';
import { CATEGORIES } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';
import WearableDataLayer from '../../modules/wearable-data-layer';

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

// Platform-branched sync. Android goes over the Wearable Data Layer; iOS is still a stub.
export async function syncToWatch(snapshot: WatchSnapshot): Promise<void> {
  if (Platform.OS === 'android') {
    return syncAndroid(snapshot);
  } else if (Platform.OS === 'ios') {
    return syncIOS(snapshot);
  }
}

// Fire-and-forget: _layout.tsx does not await this, so failures are logged here rather
// than surfaced. Sent on calendar/settings changes, once a minute while foregrounded and
// on foreground — the resync loop lives in _layout.tsx. Verified on hardware in pass 6:
// putDataItem → the watch's DataLayerClient.onDataChanged took ~3.5 s over Bluetooth.
async function syncAndroid(snapshot: WatchSnapshot): Promise<void> {
  if (!WearableDataLayer) {
    if (__DEV__) console.log('[watchSync:android] native module missing — rebuild the app');
    return;
  }
  try {
    await WearableDataLayer.sendSnapshot(JSON.stringify(snapshot));
    if (__DEV__) {
      console.log('[watchSync:android]', snapshot.currentMinute, 'min,', snapshot.events.length, 'events');
    }
  } catch (err) {
    console.warn('[watchSync:android] send failed', err);
  }
}

async function syncIOS(snapshot: WatchSnapshot): Promise<void> {
  // TODO Phase 6: call WatchConnectivityModule.sendMessage({ snapshot: JSON.stringify(snapshot) })
  if (__DEV__) console.log('[watchSync:ios]', snapshot.currentMinute, 'min');
}
