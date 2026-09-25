import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { CalendarEvent } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';

// Matches EXPO_PUBLIC_NOTIFICATION_CHANNEL in .env.example
const CHANNEL_ID = '1440-planner';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // `shouldShowAlert` was deprecated in favour of this pair; on Android both
    // together are what the old flag meant (heads-up banner + shade entry).
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Creates the Android channel and shows the system permission prompt
// (Android 13+ / iOS). Safe to call on every launch — both are idempotent.
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '1440 Planner',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Non-prompting check — use when the app returns to the foreground, in case
// the user granted (or revoked) the permission from system settings.
export async function hasPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// Cancel every scheduled notification, then schedule one reminder per event on
// `date`, firing `leadMinutes` before the event starts (0 = at start).
// Reminders whose fire time is already in the past are skipped, so it is safe
// to call this at any time of day. Returns the number scheduled.
export async function scheduleDailyReminder(
  events: CalendarEvent[],
  date: string,
  leadMinutes: number = 0
): Promise<number> {
  await cancelAllNotifications();

  const [year, month, day] = date.split('-').map(Number);
  const now = new Date();
  let scheduled = 0;

  for (const ev of events) {
    if (ev.date !== date) continue;

    // Date() normalises out-of-range minutes, so a lead time that crosses
    // midnight simply lands on the previous day and is caught by the guard.
    const fireAt = new Date(year, month - 1, day, 0, ev.startMinute - leadMinutes, 0);
    if (fireAt <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: ev.title || 'Untitled block',
        body:  reminderBody(ev, leadMinutes),
        // Read back by reminderDateFromResponse() when the user taps it.
        data:  { date: ev.date },
      },
      // `type` is required since the typed-trigger rework. Without it the object
      // still typechecks (TS lets `date` through as a member of another arm of
      // the NotificationTriggerInput union) but parseTrigger() falls all the way
      // through to the channel-aware branch and the reminder fires immediately.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: CHANNEL_ID,
      },
    });
    scheduled++;
  }

  if (__DEV__) {
    console.log(`[notifications] ${scheduled} reminder(s) for ${date}, lead ${leadMinutes}m`);
  }
  return scheduled;
}

function reminderBody(ev: CalendarEvent, leadMinutes: number): string {
  const at = minuteToTimeStr(ev.startMinute);
  const when = leadMinutes > 0 ? `Starts in ${leadMinutes}m at ${at}` : `Starting at ${at}`;
  return `${when} · ${ev.durationMinutes}m`;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// The calendar date (YYYY-MM-DD) of the reminder the user tapped, or null if
// the response is not one of ours. Android round-trips `data` through a JSON
// string, so the shape is validated rather than trusted.
export function reminderDateFromResponse(
  response: Notifications.NotificationResponse | null
): string | null {
  const date = response?.notification.request.content.data?.date;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
