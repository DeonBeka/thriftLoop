import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { colors, fs, radius, spacing, themed } from '@/constants/theme';

/** Entry point to the AI shopping assistant, shown under the search bar on Home. */
export function AskAiButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.button} accessibilityRole="button" accessibilityLabel="Ask the AI shopping assistant">
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={15} color={colors.white} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>Ask the AI stylist</Text>
        <Text style={styles.hint} numberOfLines={1}>
          “Blue tops under €10” · “Black jeans size W30”
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.secondary,
    },
    icon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex: { flex: 1 },
    title: { fontSize: fs(14), fontWeight: '600', color: colors.text },
    hint: { fontSize: fs(12), color: colors.textSecondary, marginTop: 1 },
  }),
);
