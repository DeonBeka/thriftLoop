import { Platform, type TextStyle } from 'react-native';

/** Brand palette. Neutrals below are tints of the same palette, not new hues. */
export const colors = {
  background: '#F8F8F6',
  primary: '#183D32',
  primaryPressed: '#10291F',
  secondary: '#DDE8DF',
  text: '#202522',
  textSecondary: '#858B86',
  card: '#FFFFFF',
  accent: '#B6D4BE',

  // Neutral tints derived from the background / text colours
  fill: '#EFEFEB', // input + search backgrounds
  fillPressed: '#E6E6E1',
  separator: '#E4E5E1',
  skeleton: '#ECECE8',
  placeholder: '#EEEEEA',
  border: '#E4E5E1',
  borderStrong: '#D6D9D4',
  textTertiary: '#B3B7B3',

  danger: '#C2483B',
  dangerSoft: '#F8E5E2',
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 20, 0.45)',
  scrim: 'rgba(32, 37, 34, 0.42)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;

/** Restrained radii: photos and controls get gentle rounding, not pills everywhere. */
export const radius = { xs: 4, sm: 8, md: 10, lg: 14, xl: 18, pill: 999 } as const;

/** Standard control heights so buttons/inputs line up on every screen. */
export const control = { lg: 52, md: 44, sm: 34 } as const;

export const font = {
  family: Platform.select({ ios: 'System', default: undefined }),
  size: { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 32 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;

/** Typography scale (iOS-like). Use these instead of ad-hoc font sizes. */
export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.9, color: colors.text },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
  section: { fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: -0.35, color: colors.text },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', color: colors.text },
  bodyStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '400', color: colors.textSecondary },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textSecondary },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
  price: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  priceLarge: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7, color: colors.text },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
} satisfies Record<string, TextStyle>;

export const shadow = {
  /** Only for things that float above content (image overlay buttons, sticky bars). */
  floating: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  card: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

/** Gutter used by every screen. */
export const GUTTER = spacing.lg;
