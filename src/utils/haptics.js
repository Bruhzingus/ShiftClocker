// Thin wrapper around expo-haptics. Every call is wrapped in try/catch because
// haptics throw on devices/emulators without a vibrator, and a missing buzz
// should never break a user action.
import * as Haptics from 'expo-haptics';

export function tapLight() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}
export function tapMedium() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}
export function notifySuccess() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}
export function notifyWarning() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}
