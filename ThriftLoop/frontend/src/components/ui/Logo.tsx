import { Image } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

const WORDMARK = require('../../../assets/brand/wordmark.png');
const MARK = require('../../../assets/brand/mark.png');

// Intrinsic aspect ratios of the exported artwork (width / height).
const WORDMARK_RATIO = 883 / 164;
const MARK_RATIO = 660 / 401;

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
      source={full ? WORDMARK : MARK}
      style={[{ width, height }, style]}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="ThriftLoop"
    />
  );
}
