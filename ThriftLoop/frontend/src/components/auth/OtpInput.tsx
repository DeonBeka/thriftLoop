import type { TextInputInstance } from 'react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, font, fs, radius } from '@/constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  /** Increment to trigger a shake (e.g. after a wrong code). */
  shakeKey?: number;
  disabled?: boolean;
}

/** Six boxes backed by one hidden TextInput, so iOS "From Messages/Mail" autofill works. */
export function OtpInput({ value, onChange, length = 6, error, shakeKey = 0, disabled }: OtpInputProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const offset = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  useEffect(() => {
    if (shakeKey === 0) return;
    offset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeKey, offset]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Verification code">
      <Animated.View style={[styles.row, shake]}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          const active = i === Math.min(value.length, length - 1) && !disabled;
          return (
            <View key={i} style={[styles.box, active && styles.active, !!char && styles.filled, error && styles.error]}>
              <Text style={styles.char}>{char}</Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={!disabled}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 54,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { borderColor: colors.primary },
  filled: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  error: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  char: { fontSize: fs(26), fontWeight: font.weight.bold, color: colors.primary },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
