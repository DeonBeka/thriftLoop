import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, spacing } from '@/constants/theme';

/** Shared, keyboard-aware shell for login / register / verify. */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {router.canGoBack() && (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.body}>{children}</View>
        <View style={styles.spacer} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl },
  back: { width: 40, height: 40, justifyContent: 'center', marginLeft: -8, marginBottom: spacing.lg },
  title: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: font.size.md, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 },
  body: { marginTop: spacing.xxxl, gap: spacing.lg },
  spacer: { flex: 1, minHeight: spacing.xxl },
});
