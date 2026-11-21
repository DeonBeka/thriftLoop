import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { sellerApi } from '@/services/api';
import { timeAgo } from '@/utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'person-outline', title: 'Tell us who you are', body: 'Your full name, phone number and city.' },
  { icon: 'scan-outline', title: 'Take a quick selfie', body: 'A live photo with your front camera so we know you’re a real person.' },
  { icon: 'shield-checkmark-outline', title: 'Get approved', body: 'Our team reviews it, usually within a day. Then you can start listing.' },
];

/** Sell tab for viewers: explains verification and shows application status. */
export function BecomeSeller() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { data: application, refreshing, refresh } = useApi(() => sellerApi.mine(), [user?.seller_status], {
    refetchOnFocus: true,
  });
  const status = user?.seller_status ?? 'none';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: GUTTER, paddingBottom: spacing.huge }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            await Promise.all([refresh(), refreshUser()]);
          }}
          tintColor={colors.textSecondary}
        />
      }
    >
      <Text style={type.largeTitle}>Start selling</Text>
      <Text style={[type.callout, styles.lead]}>
        To keep ThriftLoop safe, every seller is verified by our team before they can list items.
      </Text>

      {status === 'pending' && (
        <View style={[styles.status, { backgroundColor: colors.warmSoft }]}>
          <Ionicons name="time-outline" size={22} color={colors.warm} />
          <View style={styles.flex}>
            <Text style={type.headline}>Application under review</Text>
            <Text style={type.footnote}>
              Submitted {application ? timeAgo(application.created_at) : 'recently'}. We’ll unlock selling as soon as an admin approves it. Pull down to refresh.
            </Text>
          </View>
        </View>
      )}

      {status === 'rejected' && (
        <View style={[styles.status, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
          <View style={styles.flex}>
            <Text style={type.headline}>Application not approved</Text>
            {application?.admin_note ? <Text style={type.footnote}>Reason: {application.admin_note}</Text> : null}
            <Text style={type.footnote}>You can fix the issue and apply again.</Text>
          </View>
        </View>
      )}

      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <View style={styles.stepIcon}>
              <Ionicons name={s.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={type.bodyStrong}>
                {i + 1}. {s.title}
              </Text>
              <Text style={type.footnote}>{s.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {status !== 'pending' && (
        <Button
          title={status === 'rejected' ? 'Apply again' : 'Apply to sell'}
          icon="arrow-forward"
          onPress={() => router.push('/seller/apply')}
          style={{ marginTop: spacing.xxl }}
        />
      )}
      <Text style={[type.caption, styles.terms]} onPress={() => router.push('/legal/seller')}>
        By applying you agree to the <Text style={styles.link}>Seller Terms</Text>.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, gap: 2 },
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl },
  status: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.xl },
  steps: { gap: spacing.lg },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: { textAlign: 'center', marginTop: spacing.lg },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});
