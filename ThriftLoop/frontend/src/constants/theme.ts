import { Platform, type TextStyle } from 'react-native';

/**
 * Warm palette: the brand forest green and sage stay, but every neutral is shifted to a
 * cream / linen / espresso family so the app feels like paper and fabric rather than grey UI.
 */
export const colors = {
  background: '#F6F1EA', // warm cream
  primary: '#183D32', // brand forest green
  primaryPressed: '#10291F',
  secondary: '#E3E8DB', // warm sage tint
  text: '#2B2521', // espresso
  textSecondary: '#8B8178', // warm taupe
  card: '#FFFCF7', // ivory
  accent: '#B6D4BE', // brand sage

  /** Single warm highlight (terracotta), used sparingly for badges and small emphasis. */
  warm: '#C2754E',
  warmSoft: '#F3E3D7',

  // Warm neutral tints
  fill: '#EDE6DC', // input + search backgrounds (linen)
  fillPressed: '#E4DCD0',
  separator: '#E4DBCF',
  skeleton: '#EAE2D7',
  placeholder: '#EDE6DC',
  border: '#E4DBCF',
  borderStrong: '#D3C8BA',
  textTertiary: '#B9AFA4',

  danger: '#C2483B',
  dangerSoft: '#F8E5E2',
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

/** Standard control heights so buttons/inputs line up on every screen. */
export const control = { lg: 52, md: 44, sm: 34 } as const;

export const font = {
  family: Platform.select({ ios: 'System', default: undefined }),
  size: { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 32 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;

/** Typography scale (iOS-like). Use these instead of ad-hoc font sizes. */
export const type = {
  // Headings use the serif display face; body copy stays in the iOS system font.
  largeTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 33, lineHeight: 40, letterSpacing: -0.6, color: colors.text },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, lineHeight: 31, letterSpacing: -0.4, color: colors.text },
  section: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.text },
  display: { fontFamily: 'Fraunces_600SemiBold', fontSize: 28, lineHeight: 33, letterSpacing: -0.5, color: colors.text },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', color: colors.text },
  bodyStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: '400', color: colors.textSecondary },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textSecondary },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
  price: { fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  priceLarge: { fontFamily: 'Fraunces_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: colors.text },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
} satisfies Record<string, TextStyle>;

export const shadow = {
  /** Only for things that float above content (image overlay buttons, sticky bars). */
  floating: {
    shadowColor: '#3A2A1E',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  card: {
    shadowColor: '#3A2A1E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

/** Gutter used by every screen. */
export const GUTTER = spacing.lg;
