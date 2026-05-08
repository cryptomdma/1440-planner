import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { CalendarEvent } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('1440-planner', {
      name: '1440 Planner',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Cancel all scheduled notifications then re-schedule for today's events.
export async function scheduleDailyReminder(
  events: CalendarEvent[],
  date: string
): Promise<void> {
  await cancelAllNotifications();

  const now = new Date();
  for (const ev of events) {
    const [year, month, day] = date.split('-').map(Number);
    const hour   = Math.floor(ev.startMinute / 60);
    const minute = ev.startMinute % 60;
    const trigger = new Date(year, month - 1, day, hour, minute, 0);
    if (trigger <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: ev.title,
        body:  `Starting at ${minuteToTimeStr(ev.startMinute)} · ${ev.durationMinutes}m`,
      },
      trigger,
    });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
