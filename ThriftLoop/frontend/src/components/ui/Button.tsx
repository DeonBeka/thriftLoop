import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, font, radius, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Variant, { bg: string; fg: string; border?: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.white, pressed: colors.primaryPressed },
  secondary: { bg: colors.secondary, fg: colors.primary, pressed: '#CFDDD2' },
  outline: { bg: colors.card, fg: colors.text, border: colors.borderStrong, pressed: colors.background },
  ghost: { bg: 'transparent', fg: colors.primary, pressed: colors.secondary },
  danger: { bg: colors.dangerSoft, fg: colors.danger, pressed: '#F2D3CE' },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, size = 'lg', style }: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const height = size === 'lg' ? 54 : size === 'md' ? 46 : 36;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border ?? 'transparent' },
        size === 'sm' && styles.small,
        inactive && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={p.fg} />}
          <Text style={[styles.label, { color: p.fg }, size === 'sm' && styles.smallLabel]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
  },
  small: { borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: font.size.lg, fontWeight: font.weight.semibold, letterSpacing: -0.2 },
  smallLabel: { fontSize: font.size.sm },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.985 }] },
});
