import type { TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, control, fs, radius, spacing, themed } from '@/constants/theme';

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  onClear?: () => void;
  right?: ReactNode;
}

/** iOS-style search field: filled background, focus ring fades in, clear button appears with text. */
export const SearchBar = forwardRef<TextInputInstance, SearchBarProps>(function SearchBar(
  { onClear, value, placeholder = 'Search for items or brands', right, onFocus, onBlur, ...rest },
  ref,
) {
  const focus = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const animated = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], ['rgba(0,0,0,0)', colors.primary]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.fill, colors.card]),
  }));

  return (
    <Animated.View style={[styles.bar, animated]}>
      <Ionicons name="search" size={17} color={focused ? colors.text : colors.textSecondary} />
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        style={styles.input}
        onFocus={(e) => {
          setFocused(true);
          focus.value = withTiming(1, { duration: 160 });
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          focus.value = withTiming(0, { duration: 160 });
          onBlur?.(e);
        }}
        {...rest}
      />
      {!!value && onClear && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
          <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        </Animated.View>
      )}
      {right && <View>{right}</View>}
    </Animated.View>
  );
});

const styles = themed(() =>
  StyleSheet.create({
  bar: {
    height: control.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: { flex: 1, fontSize: fs(16), color: colors.text, height: '100%' },
  }),
);
