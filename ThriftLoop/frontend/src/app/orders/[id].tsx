import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ProductImage } from '@/components/product/ProductImage';
import { OrderSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { messagesApi, ordersApi } from '@/services/api';
import type { OrderStatus } from '@/types';
import { formatPrice, messageTime } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const STEPS: OrderStatus[] = ['pending', 'confirmed', 'delivered'];

export default function OrderDetail() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: order, error, loading, reload, setData } = useApi(() => ordersApi.get(Number(id)), [id], { refetchOnFocus: true });
  const [busy, setBusy] = useState<OrderStatus | null>(null);

  if (loading) return <OrderSkeleton />;
  if (error || !order) return <ErrorState message={error ?? 'Order not found.'} onRetry={reload} />;

  const isSeller = user?.id === order.seller.id || (user?.role === 'admin' && user.id !== order.buyer.id);
  const isBuyer = user?.id === order.buyer.id;
  const other = isBuyer ? order.seller : order.buyer;

  const setStatus = (status: 'confirmed' | 'delivered' | 'cancelled') => {
    const run = async () => {
      setBusy(status);
      try {
        setData(await ordersApi.setStatus(order.id, status));
        void (status === 'cancelled' ? haptic.warning() : haptic.success());
      } catch (err) {
        Alert.alert("Couldn't update order", err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setBusy(null);
      }
    };
    if (status === 'cancelled') {
      const card = order.payment_method === 'card' && order.payment_status === 'paid';
      Alert.alert('Cancel this order?', card ? `The item will go back on sale and ${formatPrice(order.total)} will be refunded to the card.` : 'The item will go back on sale.', [
        { text: 'Keep order', style: 'cancel' },
        { text: 'Cancel order', style: 'destructive', onPress: () => void run() },
      ]);
    } else if (status === 'delivered') {
      const cash = order.payment_method === 'cash_on_delivery';
      Alert.alert('Mark as delivered?', cash ? `Only do this once the buyer has received the item and paid ${formatPrice(order.total)} in cash.` : 'Only do this once the buyer has received the item. It was already paid by card.', [
        { text: 'Not yet', style: 'cancel' },
        { text: cash ? 'Delivered and paid' : 'Delivered', onPress: () => void run() },
      ]);
    } else {
      void run();
    }
  };

  const openChat = async () => {
    if (!order.product_id) return;
    try {
      if (isBuyer) {
        const convo = await messagesApi.start(order.product_id);
        router.push(`/messages/${convo.id}`);
      } else {
        const list = await messagesApi.conversations();
        const convo = list.find((c) => c.product?.id === order.product_id && c.other_user.id === order.buyer.id);
        if (convo) router.push(`/messages/${convo.id}`);
      }
    } catch (err) {
      Alert.alert("Couldn't open chat", err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const openMaps = () => {
    if (order.latitude == null || order.longitude == null) return;
    const q = encodeURIComponent(order.address_text);
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${order.latitude},${order.longitude}&q=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`;
    void Linking.openURL(url);
  };

  const stepIndex = STEPS.indexOf(order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: 140 + insets.bottom }}>
        {placed === '1' && (
          <Animated.View entering={FadeInDown.duration(350)} style={styles.placed}>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={type.headline}>Order placed</Text>
              <Text style={type.footnote}>
                {order.payment_method === 'card'
                  ? 'Paid by card. The seller has your details and will confirm soon.'
                  : 'The seller has your details and will confirm soon. Pay in cash when it arrives.'}
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={styles.header}>
          <ProductImage uri={order.product_image} style={styles.thumb} />
          <View style={styles.flex}>
            <Text style={type.title} numberOfLines={2}>
              {order.product_title}
            </Text>
            <Text style={type.footnote}>
              Order #{order.id} · {messageTime(order.created_at)}
            </Text>
            <OrderStatusBadge status={order.status} />
          </View>
        </View>

        {!cancelled && (
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.step}>
                <View style={[styles.dot, i <= stepIndex && styles.dotOn]}>
                  {i <= stepIndex && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
                <Text style={[type.caption, i <= stepIndex && { color: colors.text }]}>{s[0].toUpperCase() + s.slice(1)}</Text>
                {i < STEPS.length - 1 && <View style={[styles.line, i < stepIndex && styles.lineOn]} />}
              </View>
            ))}
          </View>
        )}

        <Text style={[type.overline, styles.label]}>{isBuyer ? 'Seller' : 'Buyer'}</Text>
        <Pressable onPress={openChat} style={styles.person} accessibilityRole="button">
          <Avatar uri={other.profile_image} name={other.username} size={40} />
          <Text style={[type.bodyStrong, styles.flex]}>@{other.username}</Text>
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </Pressable>

        <Text style={[type.overline, styles.label]}>Delivery</Text>
        <View style={styles.card}>
          <Text style={type.bodyStrong}>{order.delivery_name}</Text>
          <Text style={type.body}>{order.address_text}</Text>
          <Text style={type.callout} onPress={() => void Linking.openURL(`tel:${order.phone.replace(/\s/g, '')}`)}>
            {order.phone}
          </Text>
          {order.note ? <Text style={[type.callout, { marginTop: spacing.xs }]}>“{order.note}”</Text> : null}
          {order.latitude != null && (
            <Pressable onPress={openMaps} style={styles.mapLink}>
              <Ionicons name="map-outline" size={17} color={colors.primary} />
              <Text style={styles.mapLinkText}>Open in Maps</Text>
            </Pressable>
          )}
        </View>

        <Text style={[type.overline, styles.label]}>Payment</Text>
        <View style={[styles.card, styles.payRow]}>
          <Ionicons name={order.payment_method === 'card' ? 'card-outline' : 'cash-outline'} size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={type.body}>{order.payment_method === 'card' ? 'Card (Stripe test mode)' : 'Cash on delivery'}</Text>
            <Text style={type.footnote}>
              {order.payment_status === 'refunded'
                ? 'Refunded to the card'
                : order.payment_status === 'paid'
                  ? order.payment_method === 'card' ? 'Paid' : 'Paid in cash'
                  : 'To pay in cash on delivery'}
            </Text>
          </View>
          <Text style={[styles.price, order.payment_status === 'refunded' && styles.refunded]}>{formatPrice(order.total)}</Text>
        </View>

        <View style={[styles.card, styles.money]}>
          <MoneyRow label="Item" value={formatPrice(order.price)} />
          <MoneyRow
            label={order.city ? `Delivery to ${order.city}` : 'Delivery'}
            value={order.delivery_fee ? formatPrice(order.delivery_fee) : 'Free'}
          />
          <View style={styles.moneyDivider} />
          <MoneyRow label={isBuyer ? 'You pay' : 'Buyer pays'} value={formatPrice(order.total)} strong />
          {isSeller && (
            <>
              <MoneyRow label="ThriftLoop fee (10% of item)" value={`−${formatPrice(order.commission)}`} muted />
              {order.delivery_commission > 0 && (
                <MoneyRow label="ThriftLoop fee (5% of delivery)" value={`−${formatPrice(order.delivery_commission)}`} muted />
              )}
              <View style={styles.moneyDivider} />
              <MoneyRow label="You receive" value={formatPrice(order.seller_payout)} strong />
              {order.payment_method === 'cash_on_delivery' && order.payment_status !== 'refunded' && (
                <Text style={type.footnote}>
                  You collect {formatPrice(order.total)} in cash and pass {formatPrice(order.commission + order.delivery_commission)} on to ThriftLoop.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {(isSeller || isBuyer) && !cancelled && order.status !== 'delivered' && (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {isSeller && order.status === 'pending' && (
            <Button title="Confirm order" icon="checkmark" style={styles.flex2} loading={busy === 'confirmed'} disabled={!!busy} onPress={() => setStatus('confirmed')} />
          )}
          {isSeller && order.status === 'confirmed' && (
            <Button title="Mark delivered" icon="cube-outline" style={styles.flex2} loading={busy === 'delivered'} disabled={!!busy} onPress={() => setStatus('delivered')} />
          )}
          {(isSeller || order.status === 'pending') && (
            <Button title="Cancel" variant="outline" style={styles.flex1} loading={busy === 'cancelled'} disabled={!!busy} onPress={() => setStatus('cancelled')} />
          )}
        </View>
      )}
    </View>
  );
}

function MoneyRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[strong ? type.bodyStrong : type.callout, muted && { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[strong ? type.bodyStrong : type.body, muted && { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  money: { gap: spacing.sm, marginTop: spacing.sm },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  moneyDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: 2 },
  refunded: { textDecorationLine: 'line-through', color: colors.textSecondary },
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, gap: 4 },
  flex1: { flex: 1 },
  flex2: { flex: 1.6 },
  placed: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.secondary, marginBottom: spacing.xl },
  header: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  thumb: { width: 84, height: 105, borderRadius: radius.md },
  steps: { flexDirection: 'row', marginTop: spacing.xxl, marginBottom: spacing.sm },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotOn: { backgroundColor: colors.primary },
  line: { position: 'absolute', top: 10, left: '60%', width: '80%', height: 2, backgroundColor: colors.fill },
  lineOn: { backgroundColor: colors.primary },
  label: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card },
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, gap: 4 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(20), color: colors.text },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  mapLinkText: { color: colors.primary, fontWeight: '600', fontSize: fs(14) },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  }),
);
