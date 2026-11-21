import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ProductImage } from '@/components/product/ProductImage';
import { ConversationSkeleton } from '@/components/skeletons';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { ordersApi } from '@/services/api';
import { formatPrice, timeAgo } from '@/utils/format';

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();
  const canSell = user?.role === 'seller' || user?.role === 'admin';
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => ordersApi.list(tab), [tab], { refetchOnFocus: true });

  return (
    <View style={styles.container}>
      {canSell && (
        <View style={styles.tabs}>
          <Chip label="Purchases" selected={tab === 'buyer'} onPress={() => setTab('buyer')} />
          <Chip label="Sales" selected={tab === 'seller'} onPress={() => setTab('seller')} />
        </View>
      )}
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading ? [] : data ?? []}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
          ListEmptyComponent={
            loading ? (
              <ConversationSkeleton rows={4} />
            ) : tab === 'buyer' ? (
              <EmptyState icon="bag-handle-outline" title="No orders yet" message="Items you buy with cash on delivery show up here." actionLabel="Find something" onAction={() => router.push('/explore')} />
            ) : (
              <EmptyState icon="pricetags-outline" title="No sales yet" message="When someone orders one of your items, you’ll manage it here." />
            )
          }
          renderItem={({ item }) => {
            const other = tab === 'buyer' ? item.seller : item.buyer;
            return (
              <Pressable onPress={() => router.push(`/orders/${item.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}>
                <ProductImage uri={item.product_image} style={styles.thumb} />
                <View style={styles.flex}>
                  <Text style={type.bodyStrong} numberOfLines={1}>
                    {item.product_title}
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    #{item.id} · {tab === 'buyer' ? 'from' : 'to'} @{other.username} · {timeAgo(item.created_at)}
                  </Text>
                  <OrderStatusBadge status={item.status} />
                </View>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: GUTTER, paddingVertical: spacing.sm },
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing.huge, flexGrow: 1 },
  flex: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md },
  thumb: { width: 58, height: 72, borderRadius: radius.sm },
  price: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.text },
});
