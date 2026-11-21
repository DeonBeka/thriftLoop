import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, control, fs, radius, spacing, themed, type } from '@/constants/theme';

import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = themed(() => ({
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.secondary, fg: colors.primary, border: colors.secondary },
  outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
}));

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  size = 'lg',
  style,
  accessibilityLabel,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading; // also blocks double submits while a request runs
  const height = control[size];
  const iconOnly = !title && !!icon;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      scaleTo={0.97}
      style={[
        styles.base,
        { height, backgroundColor: p.bg, borderColor: p.border },
        iconOnly && { width: height, paddingHorizontal: 0 },
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={p.fg} />}
          {!!title && <Text style={[type.button, { color: p.fg }, size === 'sm' && styles.smallLabel]}>{title}</Text>}
        </View>
      )}
    </PressableScale>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallLabel: { fontSize: fs(14) },
  disabled: { opacity: 0.45 },
  }),
);
