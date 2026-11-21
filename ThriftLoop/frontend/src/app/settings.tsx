import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { colors, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { haptic } from '@/utils/haptics';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  if (!user) return null;

  const confirmLogout = () => {
    void haptic.warning();
    Alert.alert('Log out of ThriftLoop?', 'You can sign back in any time with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
      <Pressable onPress={() => router.push('/profile/edit')} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
        <Avatar uri={user.profile_image} name={user.username} size={54} />
        <View style={styles.flex}>
          <Text style={type.headline}>{user.username}</Text>
          <Text style={type.footnote}>
            {user.email} · {user.role === 'admin' ? 'Admin' : user.role === 'seller' ? 'Verified seller' : 'Buyer'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>

      {user.role === 'admin' && (
        <Group title="Administration">
          <Row icon="shield-checkmark-outline" label="Admin dashboard" onPress={() => router.push('/admin')} last />
        </Group>
      )}

      <Group title="Account">
        <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/profile/edit')} />
        <Row icon="color-palette-outline" label="Appearance & accessibility" onPress={() => router.push('/appearance')} />
        <Row icon="bag-outline" label="Basket" onPress={() => router.push('/basket')} />
        <Row icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
        <Row icon="heart-outline" label="Favorites" onPress={() => router.push('/favorites')} />
        <Row icon="chatbubble-outline" label="Messages" onPress={() => router.push('/messages')} last />
      </Group>

      <Group title="Selling">
        {user.role === 'viewer' ? (
          <Row
            icon="storefront-outline"
            label={user.seller_status === 'pending' ? 'Seller application (in review)' : 'Become a seller'}
            onPress={() => router.push('/sell')}
            last
          />
        ) : (
          <>
            <Row icon="add-circle-outline" label="Sell an item" onPress={() => router.push('/sell')} />
            <Row icon="pricetags-outline" label="My listings" onPress={() => router.push('/profile')} last />
          </>
        )}
      </Group>

      <Group title="Legal">
        <Row icon="document-text-outline" label="Terms of Service" onPress={() => router.push('/legal/terms')} />
        <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <Row icon="storefront-outline" label="Seller Terms" onPress={() => router.push('/legal/seller')} />
        <Row icon="cash-outline" label="Cash-on-Delivery Terms" onPress={() => router.push('/legal/delivery')} last />
      </Group>

      <Group>
        <Row icon="log-out-outline" label="Log out" destructive onPress={confirmLogout} last />
      </Group>

      <Text style={styles.version}>ThriftLoop 1.0</Text>
    </ScrollView>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {title && <Text style={[type.overline, styles.groupTitle]}>{title}</Text>}
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, onPress, destructive, last }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean; last?: boolean }) {
  const color = destructive ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
      <Ionicons name={icon} size={21} color={destructive ? colors.danger : colors.primary} />
      <View style={[styles.rowContent, !last && styles.rowDivider]}>
        <Text style={[type.body, { color }]}>{label}</Text>
        {!destructive && <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />}
      </View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, gap: 2 },
  pressed: { backgroundColor: colors.fill },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: GUTTER,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  group: { marginTop: spacing.xxl, paddingHorizontal: GUTTER },
  groupTitle: { marginBottom: spacing.sm, marginLeft: spacing.xs },
  groupBody: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, gap: spacing.md },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingRight: spacing.lg },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  version: { ...type.caption, textAlign: 'center', marginTop: spacing.xxl, color: colors.textTertiary },
  }),
);
