import { Platform } from 'react-native';

export const colors = {
  background: '#F8F8F6',
  primary: '#183D32',
  primaryPressed: '#10291F',
  secondary: '#DDE8DF',
  text: '#202522',
  textSecondary: '#858B86',
  card: '#FFFFFF',
  accent: '#B6D4BE',
  border: '#E8E9E5',
  borderStrong: '#D6D9D4',
  danger: '#C2483B',
  dangerSoft: '#F8E5E2',
  white: '#FFFFFF',
  overlay: 'rgba(16, 24, 20, 0.45)',
  placeholder: '#EEEEEA',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const font = {
  // SF Pro on iOS via the system font.
  family: Platform.select({ ios: 'System', default: undefined }),
  size: { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 30 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
