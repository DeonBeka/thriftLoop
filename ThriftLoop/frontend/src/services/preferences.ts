import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Appearance & accessibility preferences, stored on the device.
 * Read synchronously at launch so the theme is ready before any screen is styled.
 */
export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentName = 'forest' | 'terracotta' | 'ocean' | 'plum' | 'charcoal';
export type TextSize = 'default' | 'large' | 'xlarge';

export interface Preferences {
  theme: ThemeMode;
  accent: AccentName;
  textSize: TextSize;
  haptics: boolean;
  /** Read product details aloud automatically when opening an item. */
  autoSpeak: boolean;
  /** 0.7 (slow) … 1.3 (fast) */
  speechRate: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  accent: 'forest',
  textSize: 'default',
  haptics: true,
  autoSpeak: false,
  speechRate: 1,
};

const KEY = 'thriftloop.preferences';

function readRaw(): string | null {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return SecureStore.getItem(KEY);
  } catch {
    return null;
  }
}

export function loadPreferences(): Preferences {
  const raw = readRaw();
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Values in effect for this app session (theme changes apply after a quick reload). */
export const launchPreferences: Preferences = loadPreferences();

/** Live values for settings that apply instantly (haptics, speech). */
let current: Preferences = { ...launchPreferences };
export function getPreferences(): Preferences {
  return current;
}

export async function savePreferences(next: Preferences): Promise<void> {
  current = { ...next };
  const raw = JSON.stringify(next);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}
