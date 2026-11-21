import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Small wrappers so screens don't sprinkle try/catch everywhere. Haptics are best-effort.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  /** Toggles, chip/segment selection. */
  selection: () => enabled && Haptics.selectionAsync().catch(() => {}),
  /** Favorite added, small confirmations. */
  light: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** Listing published, account verified. */
  success: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** Destructive confirmations (delete, log out). */
  warning: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
