import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the FastAPI backend lives.
 * 1. EXPO_PUBLIC_API_URL from frontend/.env wins.
 * 2. Otherwise reuse the host that's serving Metro (works for Expo Go on the same Wi-Fi).
 * 3. Fall back to localhost (iOS simulator).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = resolveApiUrl();

/** Turn a backend-relative image path (/uploads/...) into a full URL. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|file:|data:)/.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
