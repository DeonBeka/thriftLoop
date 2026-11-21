import { StyleSheet, Text, View } from 'react-native';

import { colors, fs, spacing, themed } from '@/constants/theme';
import { passwordStrength } from '@/utils/passwordStrength';

/** Four-bar strength meter under the password field. Advice only: weak passwords are still allowed. */
export function PasswordStrength({ password, context }: { password: string; context?: string[] }) {
  if (!password) return null;
  const s = passwordStrength(password, context);
  const tone = [colors.danger, colors.danger, colors.warm, colors.primary, colors.primary][s.score];
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Password strength: ${s.label}. ${s.tip}`}
    >
      <View style={styles.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i <= s.score ? tone : colors.fill }]} />
        ))}
      </View>
      <Text style={styles.text}>
        <Text style={[styles.label, { color: tone }]}>{s.label}</Text>
        {'  '}
        {s.tip}
      </Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: 6, marginTop: -spacing.sm },
    bars: { flexDirection: 'row', gap: 4 },
    bar: { flex: 1, height: 4, borderRadius: 2 },
    text: { fontSize: fs(12), lineHeight: fs(17), color: colors.textSecondary },
    label: { fontWeight: '700' },
  }),
);
