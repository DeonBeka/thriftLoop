import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/product/ProductImage';
import { ConversationSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBasket, type BasketItem } from '@/hooks/useBasket';
import { productsApi } from '@/services/api';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function Basket() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useBasket();
  const { user } = useAuth();
  const ids = basket.items.map((i) => i.id);

  // Live status and price for each item (someone else may have bought it meanwhile).
  const { data: live, loading } = useApi(
    async () => {
      const results = await Promise.allSettled(ids.map((id) => productsApi.get(id)));
      const map = new Map<number, Product | null>();
      results.forEach((r, i) => map.set(ids[i], r.status === 'fulfilled' ? r.value : null));
      return map;
    },
    [ids.join(',')],
    { refetchOnFocus: true },
  );

  const isAvailable = (item: BasketItem) => {
    if (!live) return true; // still checking
    const p = live.get(item.id);
    return !!p && p.status === 'active';
  };
  const priceOf = (item: BasketItem) => live?.get(item.id)?.price ?? item.price;
  const available = basket.items.filter(isAvailable);
  const total = available.reduce((sum, i) => sum + priceOf(i), 0);

  if (!basket.count) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="bag-outline"
          title="Your basket is empty"
          message="Tap “Add to basket” on any item. You can collect several and buy them together."
          actionLabel="Start browsing"
          onAction={() => router.replace('/explore')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={basket.items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: GUTTER, paddingBottom: 150 + insets.bottom, gap: spacing.md }}
        ListHeaderComponent={
          <Text style={type.footnote}>
            {basket.count} {basket.count === 1 ? 'item' : 'items'} · Second-hand items are one of a kind, so check out soon.
          </Text>
        }
        ListFooterComponent={loading && !live ? <ConversationSkeleton rows={1} /> : undefined}
        renderItem={({ item }) => {
          const ok = isAvailable(item);
          return (
            <Animated.View exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)}>
              <Pressable
                onPress={() => router.push(`/product/${item.id}`)}
                style={({ pressed }) => [styles.row, !ok && styles.rowGone, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${formatPrice(priceOf(item))}${ok ? '' : ', no longer available'}`}
              >
                <ProductImage uri={item.image} style={styles.thumb} />
                <View style={styles.flex}>
                  <Text style={type.bodyStrong} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    Size {item.size} · {item.condition} · @{item.sellerUsername}
                  </Text>
                  {ok ? (
                    <Text style={styles.price}>{formatPrice(priceOf(item))}</Text>
                  ) : (
                    <Text style={styles.gone}>No longer available</Text>
                  )}
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  void haptic.selection();
                  basket.remove(item.id);
                }}
                hitSlop={8}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.title} from basket`}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </Animated.View>
          );
        }}
      />

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.totalRow}>
          <Text style={type.callout}>
            Total{available.length !== basket.count ? ` (${available.length} available)` : ''}
          </Text>
          <Text style={styles.total}>{formatPrice(total)}</Text>
        </View>
        <View style={styles.actions}>
          <Button title="Keep shopping" variant="outline" onPress={() => router.replace('/explore')} style={styles.flexButton} />
          <Button
            title={user ? 'Checkout' : 'Sign in to check out'}
            icon="bag-check-outline"
            onPress={() => router.push(user ? '/checkout' : '/login')}
            disabled={!available.length}
            style={styles.flexButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1, gap: 3 },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      paddingRight: spacing.xxl + spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
    },
    rowGone: { opacity: 0.6 },
    thumb: { width: 72, height: 90, borderRadius: radius.sm },
    price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(18), color: colors.text, marginTop: 2 },
    gone: { fontSize: fs(13), fontWeight: '600', color: colors.danger, marginTop: 2 },
    remove: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: spacing.md,
      paddingHorizontal: GUTTER,
      paddingTop: spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    total: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(22), color: colors.text },
    actions: { flexDirection: 'row', gap: spacing.sm },
    flexButton: { flex: 1 },
  }),
);
