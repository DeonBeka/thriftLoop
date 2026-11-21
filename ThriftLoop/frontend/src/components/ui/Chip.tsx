import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, control, fs, radius, spacing, themed } from '@/constants/theme';
import { haptic } from '@/utils/haptics';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  removable?: boolean;
  /** Plays a selection tick; on by default. */
  haptics?: boolean;
}

/** Selectable pill. Active state cross-fades instead of snapping. */
export function Chip({ label, selected = false, onPress, removable, haptics = true }: ChipProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 180 });
  }, [selected, progress]);

  // Plain strings only inside worklets (Reanimated freezes captured objects; `colors` must stay live).
  const bgFrom = colors.fill;
  const bgTo = colors.primary;
  const textFrom = colors.text;
  const textTo = colors.white;
  const container = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [bgFrom, bgTo]),
  }));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [textFrom, textTo]),
  }));

  return (
    <Pressable
      onPress={() => {
        if (haptics) void haptic.selection();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
    >
      {({ pressed }) => (
        <Animated.View style={[styles.chip, container, pressed && styles.pressed]}>
          <Animated.Text style={[styles.label, text]}>{label}</Animated.Text>
          {removable && <Ionicons name="close" size={14} color={selected ? colors.white : colors.textSecondary} />}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md + 2,
    height: control.sm,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.75 },
  label: { fontSize: fs(14), fontWeight: '500', letterSpacing: -0.1 },
  }),
);
