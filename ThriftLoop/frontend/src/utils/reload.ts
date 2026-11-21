import * as Updates from 'expo-updates';
import { DevSettings, Platform } from 'react-native';

/**
 * Re-run the app's JavaScript so new theme tokens are applied everywhere (about a second).
 * In Expo Go / development we must use DevSettings.reload(): it refreshes in place, whereas
 * Updates.reloadAsync() closes the app inside Expo Go. Real builds use Updates.reloadAsync().
 */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.location?.reload();
    return;
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
