import type { TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, control, fs, radius, spacing, themed, type } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  prefix?: string;
  secureToggle?: boolean;
  /** Right-aligned helper next to the label, e.g. a character counter. */
  meta?: string;
}

/** Filled iOS-style field: no box border at rest, a thin primary outline when focused. */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, error, hint, prefix, secureToggle, meta, style, multiline, onFocus, onBlur, secureTextEntry, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {(label || meta) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          {meta && <Text style={type.caption}>{meta}</Text>}
        </View>
      )}
      <View style={[styles.field, multiline && styles.multiline, focused && styles.focused, !!error && styles.errored]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          multiline={multiline}
          secureTextEntry={secure}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureToggle && (
          <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={type.footnote}>{hint}</Text> : null}
    </View>
  );
});

const styles = themed(() =>
  StyleSheet.create({
  wrapper: { gap: spacing.sm - 2 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: fs(13), fontWeight: '600', color: colors.text },
  field: {
    minHeight: control.lg,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  focused: { borderColor: colors.primary, backgroundColor: colors.card },
  errored: { borderColor: colors.danger, backgroundColor: colors.card },
  prefix: { fontSize: fs(17), color: colors.textSecondary, fontWeight: '500' },
  input: { flex: 1, fontSize: fs(16), color: colors.text, paddingVertical: 12 },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top', paddingVertical: 0, lineHeight: fs(22) },
  error: { fontSize: fs(13), color: colors.danger },
  }),
);
