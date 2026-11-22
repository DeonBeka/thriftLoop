import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/product/ProductImage';
import { FormSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { paymentsApi, productsApi, promotionsApi } from '@/services/api';
import type { Promotion, PromotionPlan } from '@/types';
import { formatPrice } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const PERKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'albums-outline', text: 'Top of the Home page in the Featured slideshow' },
  { icon: 'sparkles-outline', text: 'Can appear in the daily Spotlight pop-up' },
  { icon: 'flash-outline', text: 'A “Sponsored” badge that catches the eye' },
];

function untilText(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

/** Sellers pay (Stripe test mode) to feature a listing on the Home page. */
export default function Promote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const product = useApi(() => productsApi.get(Number(id)), [id]);
  const plans = useApi(() => promotionsApi.plans(), []);
  const mine = useApi(() => promotionsApi.mine(), [id]);
  const cards = useApi(() => paymentsApi.info(), []);
  const [plan, setPlan] = useState<PromotionPlan['id']>('boost_7');
  const [busy, setBusy] = useState(false);

  if (product.loading || plans.loading) return <FormSkeleton />;
  if (product.error || !product.data) return <ErrorState message={product.error ?? 'Listing not found.'} onRetry={product.reload} />;
  const p = product.data;
  if (p.seller.id !== user?.id) return <ErrorState title="Not your listing" message="You can only promote your own items." />;

  const live = (mine.data ?? []).filter((m) => m.product_id === p.id && m.status === 'active');
  const liveUntil = live.reduce<string | null>((max, m) => (!max || (m.ends_at && m.ends_at > max) ? m.ends_at : max), null);
  const chosen = plans.data?.find((x) => x.id === plan);
  const cardEnabled = !!cards.data?.card_enabled;

  const pay = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const returnUrl = Linking.createURL('promote/complete');
      const started = await promotionsApi.start(p.id, chosen.id, returnUrl);
      await WebBrowser.openAuthSessionAsync(started.url, returnUrl);
      let state: Promotion = await promotionsApi.get(started.promotion_id);
      for (let i = 0; i < 4 && state.status === 'pending'; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        state = await promotionsApi.get(started.promotion_id);
      }
      if (state.status === 'active') {
        void haptic.success();
        void mine.reload();
        Alert.alert('Your item is featured! 🎉', `“${p.title}” is in the Home slideshow until ${untilText(state.ends_at)}.`, [
          { text: 'See it on Home', onPress: () => router.replace('/') },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Payment not completed', 'Nothing was charged. You can try again any time.');
      }
    } catch (err) {
      void haptic.error();
      Alert.alert("Couldn't start the payment", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: 130 + insets.bottom, gap: spacing.lg }}>
        <View style={styles.item}>
          <ProductImage uri={p.images[0]?.url} style={styles.thumb} />
          <View style={styles.flex}>
            <Text style={type.bodyStrong} numberOfLines={2}>
              {p.title}
            </Text>
            <Text style={type.footnote}>
              {formatPrice(p.price)} · Size {p.size}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Ionicons name="rocket-outline" size={26} color={colors.white} />
          <Text style={styles.heroTitle}>Get seen first</Text>
          <Text style={styles.heroBody}>Boosted items sit at the top of Home, where every shopper starts.</Text>
        </View>

        {liveUntil && (
          <View style={styles.live}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[type.body, styles.flex]}>Featured until {untilText(liveUntil)}. Another boost adds more days.</Text>
          </View>
        )}

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk.text} style={styles.perk}>
              <Ionicons name={perk.icon} size={19} color={colors.primary} />
              <Text style={[type.body, styles.flex]}>{perk.text}</Text>
            </View>
          ))}
        </View>

        <Text style={type.headline}>Choose how long</Text>
        <View style={styles.plans} accessibilityRole="radiogroup">
          {(plans.data ?? []).map((x, i) => {
            const on = x.id === plan;
            return (
              <Animated.View key={x.id} entering={FadeInDown.delay(i * 70).duration(300)} style={styles.flex}>
                <Pressable
                  onPress={() => {
                    void haptic.selection();
                    setPlan(x.id);
                  }}
                  style={[styles.plan, on && styles.planOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  aria-checked={on}
                  accessibilityLabel={`${x.label} for ${formatPrice(x.price)}`}
                >
                  {x.id === 'boost_7' && (
                    <View style={styles.popular}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  <Text style={[styles.planDays, on && styles.planTextOn]}>{x.days}</Text>
                  <Text style={[styles.planLabel, on && styles.planTextOn]}>days</Text>
                  <Text style={[styles.planPrice, on && styles.planTextOn]}>{formatPrice(x.price)}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <Text style={type.footnote}>
          Paid by card on Stripe’s secure page (test mode in this demo: card 4242 4242 4242 4242). The boost starts as soon
          as payment is confirmed. If the item sells, it simply leaves the slideshow.
        </Text>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          title={!cardEnabled ? 'Card payments not set up' : chosen ? `Boost for ${formatPrice(chosen.price)}` : 'Boost'}
          icon="rocket-outline"
          onPress={pay}
          loading={busy}
          disabled={!cardEnabled || !chosen || p.status !== 'active'}
        />
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card },
    thumb: { width: 56, height: 70, borderRadius: radius.sm },
    hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.primary, gap: spacing.xs },
    heroTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(26), color: colors.white, marginTop: spacing.xs },
    heroBody: { fontSize: fs(15), lineHeight: fs(21), color: colors.white, opacity: 0.88 },
    live: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.secondary },
    perks: { gap: spacing.md },
    perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    plans: { flexDirection: 'row', gap: spacing.sm },
    plan: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.separator,
    },
    planOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    planDays: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(32), color: colors.text },
    planLabel: { fontSize: fs(13), color: colors.textSecondary, marginTop: -2 },
    planPrice: { fontSize: fs(16), fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    planTextOn: { color: colors.white },
    popular: { position: 'absolute', top: -10, backgroundColor: colors.warm, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
    popularText: { fontSize: fs(11), fontWeight: '700', color: colors.white },
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
