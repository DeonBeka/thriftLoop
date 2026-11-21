import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/States';
import { LAST_UPDATED, LEGAL, type LegalDocId } from '@/constants/legal';
import { colors, GUTTER, spacing, type } from '@/constants/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDocId }>();
  const insets = useSafeAreaInsets();
  const content = LEGAL[doc as LegalDocId];

  if (!content) return <ErrorState title="Not found" message="This document doesn't exist." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: GUTTER, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Stack.Screen options={{ title: content.title }} />
      <Text style={type.largeTitle}>{content.title}</Text>
      <Text style={[type.footnote, styles.updated]}>Last updated {LAST_UPDATED}</Text>
      <Text style={[type.body, styles.summary]}>{content.summary}</Text>
      {content.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={type.headline}>{s.heading}</Text>
          <Text style={[type.body, styles.body]}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  updated: { marginTop: spacing.xs },
  summary: { marginTop: spacing.lg, color: colors.textSecondary },
  section: { marginTop: spacing.xl, gap: spacing.xs },
  body: { color: colors.text },
});
