import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fs, radius, spacing, themed } from '@/constants/theme';
import { haptic } from '@/utils/haptics';

/** Agreement checkbox. `label` can contain tappable links (pass <Text onPress>). */
export function Checkbox({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; error?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        void haptic.selection();
        onChange(!checked);
      }}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={6}
    >
      <View style={[styles.box, checked && styles.boxOn, error && !checked && styles.boxError]}>
        {checked && <Ionicons name="checkmark" size={15} color={colors.white} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export const linkStyle = themed(() => ({ color: colors.primary, fontWeight: '600' as const, textDecorationLine: 'underline' as const }));

const styles = themed(() =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs + 1,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.card,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  label: { flex: 1, fontSize: fs(14), lineHeight: fs(20), color: colors.text },
  }),
);
