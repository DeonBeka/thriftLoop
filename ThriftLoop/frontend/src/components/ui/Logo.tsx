import { Image } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

import { themeState } from '@/constants/theme';

// Dark mode uses a cream version of the lettering so it stays readable.
const WORDMARK_DARK_TEXT = require('../../../assets/brand/wordmark.png');
const WORDMARK_LIGHT_TEXT = require('../../../assets/brand/wordmark-light.png');
const MARK = require('../../../assets/brand/mark.png');

// Intrinsic aspect ratios of the exported artwork (width / height).
const WORDMARK_RATIO = 883 / 164;
const MARK_RATIO = 664 / 405;

interface LogoProps {
  /** Visual height in points. */
  size?: number;
  /** `full` = "Thrift Loop" wordmark (headers, welcome); `mark` = the two-ring icon only. */
  variant?: 'full' | 'mark';
  style?: StyleProp<ImageStyle>;
}

export function Logo({ size = 24, variant = 'full', style }: LogoProps) {
  const full = variant === 'full';
  const height = size;
  const width = Math.round(height * (full ? WORDMARK_RATIO : MARK_RATIO));
  return (
    <Image
      source={full ? (themeState.isDark ? WORDMARK_LIGHT_TEXT : WORDMARK_DARK_TEXT) : MARK}
      style={[{ width, height }, style]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="ThriftLoop"
    />
  );
}
