import { Appearance, Platform, type TextStyle } from 'react-native';

import { launchPreferences, type AccentName, type Preferences, type TextSize } from '@/services/preferences';

/**
 * Live theme engine.
 *
 * `colors`, `type`, `control`, `font` and `shadow` are mutable token objects. `applyTheme()` recomputes
 * them in place and bumps a version number. Component styles are wrapped in `themed(() => StyleSheet.create(...))`,
 * which lazily rebuilds them whenever the version changes, and the root layout re-mounts the screens —
 * so light/dark, button colour and text size switch instantly without restarting the app.
 */

export const ACCENTS: Record<
  AccentName,
  { label: string; light: { primary: string; pressed: string; tint: string }; dark: { primary: string; pressed: string; tint: string } }
> = {
  forest: {
    label: 'Forest',
    light: { primary: '#183D32', pressed: '#10291F', tint: '#E3E8DB' },
    dark: { primary: '#4E9477', pressed: '#3F7D63', tint: '#22332B' },
  },
  terracotta: {
    label: 'Terracotta',
    light: { primary: '#B5562F', pressed: '#97461F', tint: '#F3E3D7' },
    dark: { primary: '#CF7650', pressed: '#B96442', tint: '#3A2A22' },
  },
  ocean: {
    label: 'Ocean',
    light: { primary: '#1F4E79', pressed: '#173D60', tint: '#DCE6F0' },
    dark: { primary: '#4F86BA', pressed: '#4174A4', tint: '#1F2C38' },
  },
  plum: {
    label: 'Plum',
    light: { primary: '#6B2E5B', pressed: '#55234A', tint: '#EEDDE9' },
    dark: { primary: '#A8649A', pressed: '#935487', tint: '#33232F' },
  },
  charcoal: {
    label: 'Charcoal',
    light: { primary: '#2B2521', pressed: '#1A1613', tint: '#E8E2DA' },
    dark: { primary: '#6A6058', pressed: '#5A5149', tint: '#2E2924' },
  },
};

export const TEXT_SCALE: Record<TextSize, number> = { default: 1, large: 1.15, xlarge: 1.3 };

const LIGHT = {
  background: '#F6F1EA', // warm cream
  text: '#2B2521', // espresso
  textSecondary: '#8B8178', // warm taupe
  textTertiary: '#B9AFA4',
  card: '#FFFCF7', // ivory
  accent: '#B6D4BE', // brand sage
  warm: '#C2754E', // terracotta highlight
  warmSoft: '#F3E3D7',
  fill: '#EDE6DC', // linen
  fillPressed: '#E4DCD0',
  separator: '#E4DBCF',
  skeleton: '#EAE2D7',
  placeholder: '#EDE6DC',
  border: '#E4DBCF',
  borderStrong: '#D3C8BA',
  danger: '#C2483B',
  dangerSoft: '#F8E5E2',
  overlayButton: 'rgba(255,255,255,0.95)',
  bar: 'rgba(246,241,234,0.97)',
  soldScrim: 'rgba(246,241,234,0.55)',
  mapHint: 'rgba(255,252,247,0.95)',
  shadow: '#3A2A1E',
};

const DARK: typeof LIGHT = {
  background: '#171412', // warm espresso night
  text: '#F2ECE4',
  textSecondary: '#A99E92',
  textTertiary: '#776D63',
  card: '#221E1A',
  accent: '#5E7F69',
  warm: '#D98B62',
  warmSoft: '#3A2A22',
  fill: '#2B2621',
  fillPressed: '#35302A',
  separator: '#352F29',
  skeleton: '#2C2722',
  placeholder: '#2B2621',
  border: '#352F29',
  borderStrong: '#4A4239',
  danger: '#E2776A',
  dangerSoft: '#3D2420',
  overlayButton: 'rgba(34,30,26,0.92)',
  bar: 'rgba(23,20,18,0.97)',
  soldScrim: 'rgba(23,20,18,0.55)',
  mapHint: 'rgba(34,30,26,0.95)',
  shadow: '#000000',
};

type Colors = typeof LIGHT & {
  primary: string;
  primaryPressed: string;
  secondary: string;
  white: string;
  overlay: string;
  scrim: string;
};

/** Current theme state (read at render time). */
export const themeState = { isDark: false, scale: 1, version: 0 };

export const colors = {} as Colors;
export const control = { lg: 52, md: 44, sm: 34 };
export const font = {
  family: Platform.select({ ios: 'System', default: undefined }),
  size: { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 32 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const as {
  family: string | undefined;
  size: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'display', number>;
  weight: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'heavy', '400' | '500' | '600' | '700' | '800'>;
};
export const type = {} as Record<
  | 'largeTitle'
  | 'title'
  | 'section'
  | 'display'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'footnote'
  | 'caption'
  | 'overline'
  | 'price'
  | 'priceLarge'
  | 'button',
  TextStyle
>;
export const shadow = {
  floating: {} as { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number },
  card: {} as { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number },
};

/** Scale a font size / line height by the user's text-size setting. */
export function fs(size: number): number {
  return Math.round(size * themeState.scale * 2) / 2;
}

/** Back-compat alias used by a few components. */
export let isDark = false;

function resolveDark(theme: Preferences['theme']): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return Appearance.getColorScheme() === 'dark';
}

/**
 * NOTE: never read `colors` / `type` directly inside a Reanimated worklet (useAnimatedStyle etc.).
 * Reanimated freezes objects that worklets capture, which would stop the theme from changing.
 * Copy the values you need into local constants first.
 */
function compute(prefs: Preferences) {
  const dark = resolveDark(prefs.theme);
  const accent = (ACCENTS[prefs.accent] ?? ACCENTS.forest)[dark ? 'dark' : 'light'];
  themeState.isDark = dark;
  themeState.scale = TEXT_SCALE[prefs.textSize] ?? 1;
  isDark = dark;

  Object.assign(colors, dark ? DARK : LIGHT, {
    primary: accent.primary,
    primaryPressed: accent.pressed,
    secondary: accent.tint,
    white: '#FFFFFF',
    overlay: 'rgba(16, 24, 20, 0.45)',
    scrim: 'rgba(32, 37, 34, 0.42)',
  });

  const controlScale = 1 + (themeState.scale - 1) * 0.8;
  control.lg = Math.round(52 * controlScale);
  control.md = Math.round(44 * controlScale);
  control.sm = Math.round(34 * controlScale);

  Object.assign(font.size, { xs: fs(12), sm: fs(13), md: fs(15), lg: fs(17), xl: fs(20), xxl: fs(24), display: fs(32) });

  // Headings use the serif display face; body copy stays in the iOS system font.
  Object.assign(type, {
    largeTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(33), lineHeight: fs(40), letterSpacing: -0.6, color: colors.text },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(25), lineHeight: fs(31), letterSpacing: -0.4, color: colors.text },
    section: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(20), lineHeight: fs(26), letterSpacing: -0.3, color: colors.text },
    display: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(28), lineHeight: fs(33), letterSpacing: -0.5, color: colors.text },
    headline: { fontSize: fs(17), lineHeight: fs(22), fontWeight: '600', letterSpacing: -0.2, color: colors.text },
    body: { fontSize: fs(15), lineHeight: fs(22), fontWeight: '400', color: colors.text },
    bodyStrong: { fontSize: fs(15), lineHeight: fs(20), fontWeight: '600', color: colors.text },
    callout: { fontSize: fs(14), lineHeight: fs(19), fontWeight: '400', color: colors.textSecondary },
    footnote: { fontSize: fs(13), lineHeight: fs(18), fontWeight: '400', color: colors.textSecondary },
    caption: { fontSize: fs(12), lineHeight: fs(16), fontWeight: '500', color: colors.textSecondary },
    overline: { fontSize: fs(11), lineHeight: fs(14), fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
    price: { fontSize: fs(15), lineHeight: fs(20), fontWeight: '700', letterSpacing: -0.2, color: colors.text },
    priceLarge: { fontFamily: 'Fraunces_700Bold', fontSize: fs(28), lineHeight: fs(34), letterSpacing: -0.4, color: colors.text },
    button: { fontSize: fs(16), fontWeight: '600', letterSpacing: -0.2 },
  } satisfies Record<string, TextStyle>);

  Object.assign(shadow.floating, {
    shadowColor: colors.shadow,
    shadowOpacity: dark ? 0.4 : 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  });
  Object.assign(shadow.card, {
    shadowColor: colors.shadow,
    shadowOpacity: dark ? 0.25 : 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  });
}

compute(launchPreferences);

// ---------- live updates ----------
const listeners = new Set<() => void>();

/** Where to send the user after the screens re-mount for a theme change (e.g. back to Appearance). */
export const themeNav: { returnTo: string | null } = { returnTo: null };

/** Recompute every token for new preferences and tell the app to re-render. */
export function applyTheme(prefs: Preferences): void {
  compute(prefs);
  themeState.version += 1;
  listeners.forEach((l) => l());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Wrap a style factory so its styles rebuild after a theme change:
 *   const styles = themed(() => StyleSheet.create({ ... }));
 * Access works exactly like a normal StyleSheet object.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let cacheVersion = -1;
  const current = (): T => {
    if (cacheVersion !== themeState.version || cache === null) {
      cache = factory();
      cacheVersion = themeState.version;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_target, key) => (current() as Record<string | symbol, unknown>)[key],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;

/** Soft, modern radii: photos and controls get friendly rounding, pills only for chips. */
export const radius = { xs: 5, sm: 9, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Serif display face (Fraunces) — echoes the serif in the ThriftLoop wordmark. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
} as const;

/** Gutter used by every screen. */
export const GUTTER = spacing.lg;
