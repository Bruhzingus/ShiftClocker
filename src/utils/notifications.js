// Local reminder notifications (no server / push tokens). Works in standalone /
// preview APK builds and in Expo Go (local scheduling only).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_ID    = 'daily-log-reminder';
const CLOCKOUT_ID = 'clockout-reminder';
const CHANNEL_ID  = 'reminders';

// Show reminders even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // legacy key (older SDKs)
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  let status = (await Notifications.getPermissionsAsync()).status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  return status === 'granted';
}

// Reschedule (or clear) the daily "did you log your shift?" reminder. Returns
// false if it couldn't be scheduled (e.g. permission denied) so the UI can warn.
export async function syncDailyReminder(reminders) {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  if (!reminders || !reminders.enabled) return true;

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const [h, m] = String(reminders.time || '19:00').split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: 'ShiftClocker', body: 'Did you log today’s shift?' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Number.isFinite(h) ? h : 19,
      minute: Number.isFinite(m) ? m : 0,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

// One-shot "still clocked in" reminder, scheduled when the user clocks in.
export async function scheduleClockOutReminder(hours) {
  const hrs = Number(hours) || 0;
  if (hrs <= 0) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: CLOCKOUT_ID,
    content: { title: 'Still clocked in', body: `You've been clocked in for ${hrs}h — don't forget to clock out.` },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: hrs * 3600,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelClockOutReminder() {
  await Notifications.cancelScheduledNotificationAsync(CLOCKOUT_ID).catch(() => {});
}
