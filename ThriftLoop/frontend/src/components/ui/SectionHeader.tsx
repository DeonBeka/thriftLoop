import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/constants/theme';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={type.section}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={10}>
          {({ pressed }) => <Text style={[styles.action, pressed && { opacity: 0.5 }]}>{action}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.md },
  action: { fontSize: 15, fontWeight: '500', color: colors.primary },
});
