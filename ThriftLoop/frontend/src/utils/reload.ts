import * as Updates from 'expo-updates';
import { DevSettings, Platform } from 'react-native';

/** Restart the JS app so new theme tokens are applied everywhere (takes about a second). */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.location?.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go / development: fall back to the dev reload.
    DevSettings.reload();
  }
}
