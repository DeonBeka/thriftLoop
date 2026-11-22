import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ConversationSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { adminApi } from '@/services/api';
import type { SellerApplication } from '@/types';
import { timeAgo } from '@/utils/format';
import { formatPrice } from '@/utils/format';

type Filter = 'pending' | 'approved' | 'rejected';

export default function AdminDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('pending');
  const stats = useApi(() => adminApi.stats(), [], { refetchOnFocus: true });
  const apps = useApi(() => adminApi.applications(filter), [filter], { refetchOnFocus: true });

  const refresh = async () => {
    await Promise.all([stats.reload(), apps.refresh()]);
  };

  const tiles = stats.data
    ? [
        { label: 'Pending', value: stats.data.pending_applications, warm: stats.data.pending_applications > 0 },
        { label: 'Users', value: stats.data.users },
        { label: 'Sellers', value: stats.data.sellers },
        { label: 'Listings', value: stats.data.active_listings },
        { label: 'Open orders', value: stats.data.open_orders },
      ]
    : [];

  const header = (
    <View>
      {stats.data && (
        <View style={styles.earnings} accessible accessibilityLabel={`ThriftLoop earnings ${formatPrice(stats.data.earned)}`}>
          <Text style={styles.earningsLabel}>ThriftLoop earnings</Text>
          <Text style={styles.earningsValue}>{formatPrice(stats.data.earned)}</Text>
          <Text style={styles.earningsNote}>
            10% of every sale + 5% of delivery, from {stats.data.delivered_orders} delivered{' '}
            {stats.data.delivered_orders === 1 ? 'order' : 'orders'} ({formatPrice(stats.data.sales_volume)} in sales).
          </Text>
          {stats.data.earned_pending > 0 && (
            <Text style={styles.earningsNote}>+ {formatPrice(stats.data.earned_pending)} on open orders, earned once delivered.</Text>
          )}
        </View>
      )}
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, t.warm && { backgroundColor: colors.warmSoft }]}>
            <Text style={[styles.tileValue, t.warm && { color: colors.warm }]}>{t.value}</Text>
            <Text style={type.caption}>{t.label}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push('/admin/users')} style={({ pressed }) => [styles.usersRow, pressed && { opacity: 0.7 }]}>
        <Ionicons name="people-outline" size={21} color={colors.primary} />
        <Text style={[type.bodyStrong, styles.flex]}>Manage users and sellers</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>

      <Text style={[type.section, styles.sectionTitle]}>Seller applications</Text>
      <View style={styles.chips}>
        {(['pending', 'approved', 'rejected'] as const).map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
    </View>
  );

  if (stats.error && !stats.data) return <ErrorState message={stats.error} onRetry={stats.reload} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={apps.loading ? [] : apps.data ?? []}
      keyExtractor={(a) => String(a.id)}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={apps.refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
      ListEmptyComponent={
        apps.loading ? (
          <ConversationSkeleton rows={3} />
        ) : (
          <EmptyState
            icon={filter === 'pending' ? 'checkmark-done-outline' : 'document-outline'}
            title={filter === 'pending' ? 'All caught up' : `No ${filter} applications`}
            message={filter === 'pending' ? 'New seller applications will show up here.' : undefined}
          />
        )
      }
      renderItem={({ item }) => <ApplicationRow app={item} onPress={() => router.push(`/admin/application/${item.id}`)} />}
    />
  );
}

function ApplicationRow({ app, onPress }: { app: SellerApplication; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}>
      <Avatar uri={app.user.profile_image} name={app.user.username} size={46} />
      <View style={styles.flex}>
        <Text style={type.bodyStrong}>{app.full_name}</Text>
        <Text style={type.footnote} numberOfLines={1}>
          @{app.user.username} · {app.city} · {timeAgo(app.created_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  earnings: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary, gap: 4, marginBottom: spacing.md },
  earningsLabel: { fontSize: fs(13), fontWeight: '600', color: colors.white, opacity: 0.85 },
  earningsValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(34), color: colors.white },
  earningsNote: { fontSize: fs(13), lineHeight: fs(18), color: colors.white, opacity: 0.85 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing.huge, flexGrow: 1 },
  flex: { flex: 1, gap: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tile: { flexGrow: 1, minWidth: '30%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  tileValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(26), color: colors.text },
  usersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md },
  }),
);
