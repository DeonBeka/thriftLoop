import { Appearance, Platform, type TextStyle } from 'react-native';

import { launchPreferences, type AccentName, type TextSize } from '@/services/preferences';

/**
 * Theme engine. The palette is resolved once at launch from the user's Appearance settings
 * (light / dark / system, button colour, text size). Changing a setting reloads the app so every
 * screen re-renders with the new tokens — simple, fast, and nothing can be left half-themed.
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

function resolveDark(): boolean {
  if (launchPreferences.theme === 'dark') return true;
  if (launchPreferences.theme === 'light') return false;
  return Appearance.getColorScheme() === 'dark';
}

export const isDark = resolveDark();
const accent = (ACCENTS[launchPreferences.accent] ?? ACCENTS.forest)[isDark ? 'dark' : 'light'];
const scale = TEXT_SCALE[launchPreferences.textSize] ?? 1;

/** Scale a font size / line height by the user's text-size setting. */
export function fs(size: number): number {
  return Math.round(size * scale * 2) / 2;
}

const light = {
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
  // Surfaces drawn over photos / content
  overlayButton: 'rgba(255,255,255,0.95)',
  bar: 'rgba(246,241,234,0.97)',
  soldScrim: 'rgba(246,241,234,0.55)',
  mapHint: 'rgba(255,252,247,0.95)',
  shadow: '#3A2A1E',
};

const dark: typeof light = {
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

const base = isDark ? dark : light;

export const colors = {
  ...base,
  primary: accent.primary,
  primaryPressed: accent.pressed,
  secondary: accent.tint,
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 20, 0.45)',
  scrim: 'rgba(32, 37, 34, 0.42)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;

/** Soft, modern radii: photos and controls get friendly rounding, pills only for chips. */
export const radius = { xs: 5, sm: 9, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Serif display face (Fraunces) — echoes the serif in the ThriftLoop wordmark. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
} as const;

/** Standard control heights (grow with the text-size setting so buttons stay easy to hit). */
const controlScale = 1 + (scale - 1) * 0.8;
export const control = {
  lg: Math.round(52 * controlScale),
  md: Math.round(44 * controlScale),
  sm: Math.round(34 * controlScale),
} as const;

export const font = {
  family: Platform.select({ ios: 'System', default: undefined }),
  size: { xs: fs(12), sm: fs(13), md: fs(15), lg: fs(17), xl: fs(20), xxl: fs(24), display: fs(32) },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;

/** Typography scale (iOS-like). Use these instead of ad-hoc font sizes. */
export const type = {
  // Headings use the serif display face; body copy stays in the iOS system font.
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
} satisfies Record<string, TextStyle>;

export const shadow = {
  /** Only for things that float above content (image overlay buttons, sticky bars). */
  floating: {
    shadowColor: colors.shadow,
    shadowOpacity: isDark ? 0.4 : 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

/** Gutter used by every screen. */
export const GUTTER = spacing.lg;
