import type { TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, spacing } from '@/constants/theme';

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  /** Render as a tappable placeholder (e.g. on Home) instead of a text input. */
  onPressFake?: () => void;
  onClear?: () => void;
  right?: ReactNode;
}

export const SearchBar = forwardRef<TextInputInstance, SearchBarProps>(function SearchBar(
  { onPressFake, onClear, value, placeholder = 'Search hoodies, jeans, sneakers…', right, ...rest },
  ref,
) {
  if (onPressFake) {
    return (
      <Pressable onPress={onPressFake} style={styles.bar} accessibilityRole="search" accessibilityLabel="Search">
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <Text style={styles.placeholder}>{placeholder}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.bar}>
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
      {!!value && onClear && (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
      {right}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  placeholder: { fontSize: font.size.md, color: colors.textSecondary, flex: 1 },
  input: { flex: 1, fontSize: font.size.md, color: colors.text, height: '100%' },
});
