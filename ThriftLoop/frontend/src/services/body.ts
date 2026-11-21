import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Body } from '@/utils/fit';

/** The shopper's height and weight for Live view. Stays on this device only. */
const KEY = 'thriftloop.body';

export function loadBody(): Body | null {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    if (!raw) return null;
    const body = JSON.parse(raw) as Body;
    return body.heightCm > 0 && body.weightKg > 0 ? body : null;
  } catch {
    return null;
  }
}

export async function saveBody(body: Body): Promise<void> {
  const raw = JSON.stringify(body);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}
