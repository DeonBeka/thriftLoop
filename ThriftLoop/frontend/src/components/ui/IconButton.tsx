import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fs, shadow } from '@/constants/theme';

import { PressableScale } from './PressableScale';

interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  label: string;
  badge?: number;
  /** White circle with a soft shadow, for buttons drawn over photos. */
  floating?: boolean;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bare icon (nav-bar style) by default; `floating` for over-image controls. */
export function IconButton({ icon, onPress, label, badge, floating, color = colors.text, size = 22, style }: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      scaleTo={0.9}
      style={[styles.button, floating && styles.floating, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  floating: { backgroundColor: colors.overlayButton, ...shadow.floating },
  badge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.warm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: colors.white, fontSize: fs(9), fontWeight: '700' },
});
