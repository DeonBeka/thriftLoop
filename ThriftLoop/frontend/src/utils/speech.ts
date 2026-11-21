import * as Speech from 'expo-speech';

import { getPreferences } from '@/services/preferences';
import type { Product } from '@/types';

import { formatPrice } from './format';

/**
 * Read-aloud for people who are blind or have low vision (works alongside iOS VoiceOver).
 * Uses the device's built-in voices, so it works offline and costs nothing.
 */
export function speak(text: string, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: 'en-US',
    rate: getPreferences().speechRate,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export function describeProduct(p: Product): string {
  const status = p.status === 'sold' ? ' This item has been sold.' : p.status === 'reserved' ? ' This item is reserved.' : '';
  return [
    `${p.title}.`,
    `${formatPrice(p.price).replace('€', '')} euros.`,
    `Size ${p.size}. Condition: ${p.condition}. Category: ${p.category}.`,
    p.description ? `Description: ${p.description}` : '',
    `Sold by ${p.seller.username}.${status}`,
  ]
    .filter(Boolean)
    .join(' ');
}
