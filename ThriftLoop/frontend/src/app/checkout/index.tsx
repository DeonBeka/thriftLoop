import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapPicker, type PickedLocation } from '@/components/checkout/MapPicker';
import { ProductImage } from '@/components/product/ProductImage';
import { CheckoutSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/Button';
import { Checkbox, linkStyles } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBasket } from '@/hooks/useBasket';
import { ordersApi, productsApi } from '@/services/api';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';
import { haptic } from '@/utils/haptics';

type Mode = 'map' | 'text';
type Field = 'name' | 'phone' | 'address' | 'terms';

/** Checkout for everything in the basket: one set of delivery details, cash on delivery. */
export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const basket = useBasket();
  const ids = basket.items.map((i) => i.id);

  // Re-check every item with the server: price and availability may have changed since it was added.
  const { data, error, loading, reload } = useApi(
    async () => {
      const results = await Promise.allSettled(ids.map((id) => productsApi.get(id)));
      return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    },
    [ids.join(',')],
  );

  const [mode, setMode] = useState<Mode>('map');
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [placing, setPlacing] = useState(false);

  if (!user) {
    return (
      <EmptyState
        icon="person-circle-outline"
        title="Sign in to check out"
        message="Your basket is saved. Sign in or create an account to place your order."
        actionLabel="Sign in"
        onAction={() => router.push('/login')}
      />
    );
  }
  if (!ids.length) {
    return (
      <EmptyState
        icon="bag-outline"
        title="Your basket is empty"
        message="Add items to your basket, then come back to check out."
        actionLabel="Find something"
        onAction={() => router.replace('/explore')}
      />
    );
  }
  if (loading && !data) return <CheckoutSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const buyable: Product[] = (data ?? []).filter((p) => p.status === 'active' && p.seller.id !== user?.id);
  const unavailable = basket.items.filter((i) => !buyable.some((p) => p.id === i.id));
  const total = buyable.reduce((sum, p) => sum + p.price, 0);
  const sellers = new Set(buyable.map((p) => p.seller.id)).size;

  const onPick = (loc: PickedLocation) => {
    setLocation(loc);
    // Fill the text address from the map, but never overwrite something the buyer typed by hand.
    if (loc.address && (!address || address === location?.address)) setAddress(loc.address);
    setErrors((e) => ({ ...e, address: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) next.name = 'Who should the courier ask for?';
    if (phone.replace(/\D/g, '').length < 8) next.phone = 'Enter a phone number the seller can call.';
    if (address.trim().length < 5) next.address = mode === 'map' ? 'Move the map to your address or type it.' : 'Enter your full address.';
    if (!accepted) next.terms = 'Please accept the cash-on-delivery terms.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    if (!buyable.length) return;
    if (!validate()) {
      void haptic.error();
      return;
    }
    setPlacing(true);
    try {
      const orders = await ordersApi.checkout({
        product_ids: buyable.map((p) => p.id),
        delivery_name: name.trim(),
        phone: phone.trim(),
        address_text: address.trim(),
        latitude: mode === 'map' ? location?.latitude ?? null : null,
        longitude: mode === 'map' ? location?.longitude ?? null : null,
        note: note.trim() || undefined,
        accept_terms: true,
      });
      basket.removeMany(orders.map((o) => o.product_id).filter((id): id is number => id != null));
      void haptic.success();
      if (orders.length === 1) router.replace(`/orders/${orders[0].id}?placed=1`);
      else router.replace(`/orders?placed=${orders.length}`);
    } catch (err) {
      void haptic.error();
      Alert.alert(
        "Couldn't place order",
        `${err instanceof Error ? err.message : 'Please try again.'}\n\nNothing was ordered. Your basket and details are still here.`,
      );
      void reload();
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: GUTTER, paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={type.headline}>
          {buyable.length} {buyable.length === 1 ? 'item' : 'items'}
          {sellers > 1 ? ` from ${sellers} sellers` : ''}
        </Text>
        <View style={styles.items}>
          {buyable.map((p) => (
            <View key={p.id} style={styles.summary}>
              <ProductImage uri={p.images[0]?.url} style={styles.thumb} />
              <View style={styles.flex}>
                <Text style={type.bodyStrong} numberOfLines={1}>
                  {p.title}
                </Text>
                <Text style={type.footnote} numberOfLines={1}>
                  Size {p.size} · {p.condition} · @{p.seller.username}
                </Text>
              </View>
              <Text style={styles.price}>{formatPrice(p.price)}</Text>
            </View>
          ))}
        </View>
        {unavailable.length > 0 && (
          <View style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={[type.footnote, styles.flex]}>
              {unavailable.map((i) => i.title).join(', ')} {unavailable.length === 1 ? 'is' : 'are'} no longer available and
              won’t be ordered.
            </Text>
            <Text style={styles.removeLink} onPress={() => basket.removeMany(unavailable.map((i) => i.id))} suppressHighlighting>
              Remove
            </Text>
          </View>
        )}
        {sellers > 1 && (
          <Text style={[type.footnote, styles.note]}>
            Each seller gets their own order and delivers separately. You pay each one in cash when their item arrives.
          </Text>
        )}

        <Text style={[type.headline, styles.section]}>Delivery address</Text>
        <View style={styles.modes}>
          <Chip label="Pick on map" selected={mode === 'map'} onPress={() => setMode('map')} />
          <Chip label="Type address" selected={mode === 'text'} onPress={() => setMode('text')} />
        </View>
        {mode === 'map' && (
          <View style={{ marginBottom: spacing.lg }}>
            <MapPicker value={location} onChange={onPick} />
          </View>
        )}
        <View style={styles.fields}>
          <TextField
            label={mode === 'map' ? 'Address (from the map, edit if needed)' : 'Address'}
            placeholder="Street, number, city"
            value={address}
            onChangeText={(t) => {
              setAddress(t);
              setErrors((e) => ({ ...e, address: undefined }));
            }}
            multiline
            error={errors.address}
            textContentType="fullStreetAddress"
          />
          <TextField label="Name for delivery" placeholder="Full name" value={name} onChangeText={setName} error={errors.name} textContentType="name" autoComplete="name" />
          <TextField label="Phone" placeholder="+383 44 123 456" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone} textContentType="telephoneNumber" autoComplete="tel" />
          <TextField label="Note for the seller (optional)" placeholder="Floor, doorbell, best time to call…" value={note} onChangeText={setNote} maxLength={500} />
        </View>

        <Text style={[type.headline, styles.section]}>Payment</Text>
        <View style={styles.payment}>
          <View style={styles.payIcon}>
            <Ionicons name="cash-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={type.bodyStrong}>Cash on delivery</Text>
            <Text style={type.footnote}>Pay in cash when you receive your items. No card needed.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        </View>

        <View style={styles.totals}>
          <Row label={`Items (${buyable.length})`} value={formatPrice(total)} />
          <Row label="Delivery" value="Agree with the seller" muted />
          <View style={styles.divider} />
          <Row label="Pay on delivery" value={formatPrice(total)} strong />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Checkbox
            checked={accepted}
            onChange={(v) => {
              setAccepted(v);
              if (v) setErrors((e) => ({ ...e, terms: undefined }));
            }}
            error={!!errors.terms}
            label={
              <>
                I’ll pay in cash on delivery and agree to the{' '}
                <Text style={linkStyles.link} onPress={() => router.push('/legal/delivery')}>
                  Cash-on-Delivery Terms
                </Text>
                .
              </>
            }
          />
          {errors.terms && <Text style={styles.error}>{errors.terms}</Text>}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          title={buyable.length ? `Place order · ${formatPrice(total)}` : 'Nothing available to order'}
          onPress={placeOrder}
          loading={placing}
          disabled={!buyable.length}
        />
      </View>
    </View>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={strong ? type.bodyStrong : type.callout}>{label}</Text>
      <Text style={[strong ? styles.totalValue : type.body, muted && { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1, gap: 2 },
    items: { gap: spacing.sm, marginTop: spacing.md },
    summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card },
    thumb: { width: 52, height: 65, borderRadius: radius.sm },
    price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(18), color: colors.text },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
    },
    removeLink: { fontSize: fs(14), fontWeight: '600', color: colors.danger },
    note: { marginTop: spacing.md },
    section: { marginTop: spacing.xxl, marginBottom: spacing.md },
    modes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    fields: { gap: spacing.lg },
    payment: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.secondary },
    payIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    totals: { marginTop: spacing.lg, gap: spacing.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    totalValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(20), color: colors.text },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.xs },
    error: { color: colors.danger, fontSize: fs(13), marginTop: spacing.sm },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: GUTTER,
      paddingTop: spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
  }),
);
