import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { getPreferences } from '@/services/preferences';
import { speak } from '@/utils/speech';

/** What the voice guide says when you arrive on each screen. */
const SCREENS: { match: RegExp; say: string }[] = [
  { match: /^\/$/, say: 'Home. Browse categories, picks for you, and new items.' },
  { match: /^\/explore/, say: 'Explore. Search for items and use filters.' },
  { match: /^\/sell/, say: 'Sell. Add photos and details to list an item.' },
  { match: /^\/favorites/, say: 'Favorites. Items you have saved.' },
  { match: /^\/profile\/edit/, say: 'Edit profile.' },
  { match: /^\/profile/, say: 'Your profile. Your listings and sold items.' },
  { match: /^\/settings/, say: 'Settings.' },
  { match: /^\/appearance/, say: 'Appearance and accessibility.' },
  { match: /^\/live-view/, say: 'Live view. A mannequin with your height and weight wearing the item, with a fit verdict.' },
  { match: /^\/assistant/, say: 'AI stylist. Type what you are looking for, for example blue tops under ten euros.' },
  { match: /^\/messages\/\d+/, say: 'Chat.' },
  { match: /^\/messages/, say: 'Messages.' },
  { match: /^\/orders\/\d+/, say: 'Order details.' },
  { match: /^\/orders/, say: 'Orders.' },
  { match: /^\/promote/, say: 'Boost listing. Pay to feature your item at the top of the Home page.' },
  { match: /^\/basket/, say: 'Basket. Items you want to buy. Tap checkout to order them together.' },
  { match: /^\/checkout/, say: 'Checkout. Enter your delivery address. You pay in cash on delivery.' },
  { match: /^\/seller\/apply/, say: 'Seller verification. Enter your details and take a selfie.' },
  { match: /^\/user\//, say: 'Seller profile.' },
  { match: /^\/admin\/application/, say: 'Review seller application.' },
  { match: /^\/admin\/users/, say: 'Manage users.' },
  { match: /^\/admin/, say: 'Admin dashboard.' },
  { match: /^\/legal/, say: 'Legal document.' },
  { match: /^\/welcome/, say: 'Welcome to ThriftLoop.' },
  { match: /^\/login/, say: 'Sign in.' },
  { match: /^\/register/, say: 'Create account.' },
  // Product pages read the full item themselves.
];

/**
 * Voice guide: announces each screen as you move through the app, so people who can't see the
 * screen always know where they are. Product pages read their details aloud. It stays quiet
 * when iOS VoiceOver is on, because VoiceOver already does this.
 */
export function VoiceGuide() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!getPreferences().autoSpeak || pathname === last.current) return;
    last.current = pathname;
    const entry = SCREENS.find((s) => s.match.test(pathname));
    if (!entry) return;
    let cancelled = false;
    void AccessibilityInfo.isScreenReaderEnabled()
      .catch(() => false)
      .then((voiceOver) => {
        if (!cancelled && !voiceOver) speak(entry.say);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
