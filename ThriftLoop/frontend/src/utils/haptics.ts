import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getPreferences } from '@/services/preferences';

// Small wrappers so screens don't sprinkle try/catch everywhere. Haptics are best-effort and
// respect the "Haptic feedback" switch in Appearance & accessibility.
const supported = Platform.OS === 'ios' || Platform.OS === 'android';
const enabledNow = () => supported && getPreferences().haptics;

export const haptic = {
  /** Toggles, chip/segment selection. */
  selection: () => enabledNow() && Haptics.selectionAsync().catch(() => {}),
  /** Favorite added, small confirmations. */
  light: () => enabledNow() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => enabledNow() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** Listing published, account verified. */
  success: () => enabledNow() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** Destructive confirmations (delete, log out). */
  warning: () => enabledNow() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => enabledNow() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
