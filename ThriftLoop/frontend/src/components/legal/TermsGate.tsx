import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Checkbox, linkStyle } from '@/components/ui/Checkbox';
import { Logo } from '@/components/ui/Logo';
import { colors, fs, GUTTER, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/services/api';
import { haptic } from '@/utils/haptics';

/** Shown once to accounts that haven't accepted the current Terms (e.g. created before they existed). */
export function TermsGate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, logout } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    setSaving(true);
    try {
      setUser(await authApi.acceptTerms());
      void haptic.success();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <Logo size={24} />
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={28} color={colors.primary} />
        </View>
        <Text style={type.largeTitle}>We’ve updated our terms</Text>
        <Text style={[type.body, styles.text]}>
          ThriftLoop now has seller verification and cash-on-delivery orders. Please review and accept the terms to keep using the app.
        </Text>
        <View style={styles.links}>
          {(['terms', 'privacy', 'delivery'] as const).map((doc) => (
            <Text key={doc} style={[linkStyle, styles.link]} onPress={() => router.push(`/legal/${doc}`)}>
              {doc === 'terms' ? 'Terms of Service' : doc === 'privacy' ? 'Privacy Policy' : 'Cash-on-Delivery Terms'}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Checkbox checked={checked} onChange={setChecked} label="I have read and agree to the Terms of Service and Privacy Policy." />
        <Button title="Accept and continue" onPress={accept} loading={saving} disabled={!checked} />
        <Button title="Log out" variant="ghost" size="md" onPress={() => void logout()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: GUTTER },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  text: { color: colors.textSecondary },
  links: { gap: spacing.md, marginTop: spacing.sm },
  link: { fontSize: fs(16) },
  footer: { gap: spacing.md },
});
