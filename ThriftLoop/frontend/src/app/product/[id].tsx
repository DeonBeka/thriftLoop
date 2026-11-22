import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddedToBasketSheet } from '@/components/basket/AddedToBasketSheet';
import { PromoPopup } from '@/components/promotions/PromoPopup';
import { FavoriteButton } from '@/components/product/FavoriteButton';
import { ImageGallery } from '@/components/product/ImageGallery';
import { ProductDetailsSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ErrorState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, shadow, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBasket } from '@/hooks/useBasket';
import { messagesApi, productsApi } from '@/services/api';
import { formatPrice, timeAgo } from '@/utils/format';
import { getPreferences } from '@/services/preferences';
import { haptic } from '@/utils/haptics';
import { describeProduct, speak, stopSpeaking } from '@/utils/speech';

export default function ProductDetails() {
  const { id, justListed } = useLocalSearchParams<{ id: string; justListed?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState<null | 'message' | 'status' | 'delete'>(null);
  const basket = useBasket();
  const [addedOpen, setAddedOpen] = useState(false);
  const [boostPromptOpen, setBoostPromptOpen] = useState(justListed === '1');
  const inBasket = basket.has(Number(id));

  const { data: product, error, loading, refreshing, refresh, reload, setData } = useApi(
    () => productsApi.get(Number(id)),
    [id],
    { refetchOnFocus: true },
  );

  // Read-aloud: optional auto-play when opening an item, always stopped when leaving the screen.
  const [speaking, setSpeaking] = useState(false);
  const spokenFor = useRef<number | null>(null);
  useEffect(() => {
    if (product && getPreferences().autoSpeak && spokenFor.current !== product.id) {
      spokenFor.current = product.id;
      setSpeaking(true);
      speak(describeProduct(product), () => setSpeaking(false));
    }
  }, [product]);
  useEffect(() => () => stopSpeaking(), []);

  const toggleSpeech = () => {
    if (!product) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(describeProduct(product), () => setSpeaking(false));
  };

  const back = (
    <View style={[styles.topBar, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" label="Back" floating onPress={() => router.back()} />
      {product && (
        <View style={styles.topRight}>
          <IconButton
            icon={speaking ? 'stop-circle-outline' : 'volume-high-outline'}
            label={speaking ? 'Stop reading' : 'Read item details aloud'}
            floating
            onPress={toggleSpeech}
          />
          <IconButton icon="bag-outline" label="Basket" badge={basket.count} floating onPress={() => router.push('/basket')} />
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ProductDetailsSkeleton />
        {back}
      </View>
    );
  }
  if (error || !product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 56 }]}>
        <ErrorState
          title="Listing unavailable"
          message={error ?? 'This listing no longer exists.'}
          onRetry={error?.includes('no longer') ? undefined : reload}
        />
        {back}
      </View>
    );
  }

  const isOwner = user?.id === product.seller.id;
  const sold = product.status === 'sold';
  const reserved = product.status === 'reserved';

  const messageSeller = async () => {
    setBusy('message');
    try {
      const convo = await messagesApi.start(product.id);
      router.push(`/messages/${convo.id}`);
    } catch (err) {
      void haptic.error();
      Alert.alert("Couldn't open chat", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const toggleSold = async () => {
    setBusy('status');
    try {
      const updated = await productsApi.update(product.id, { status: sold ? 'active' : 'sold' });
      setData(updated);
      void haptic.success();
      void refreshUser();
    } catch (err) {
      Alert.alert("Couldn't update listing", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const deleteListing = () => {
    void haptic.warning();
    Alert.alert('Delete this listing?', 'It will be removed from ThriftLoop and from everyone’s favorites. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await productsApi.remove(product.id);
            void refreshUser();
            router.back();
          } catch (err) {
            setBusy(null);
            Alert.alert("Couldn't delete", err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const ownerMenu = () => {
    const options = ['Edit listing', sold ? 'Mark as available' : 'Mark as sold', 'Delete listing', 'Boost on Home', 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) router.push(`/product/edit/${product.id}`);
      if (i === 1) void toggleSold();
      if (i === 2) deleteListing();
      if (i === 3) router.push(`/promote/${product.id}`);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4, destructiveButtonIndex: 2 }, handle);
    } else {
      Alert.alert('Listing', undefined, [
        { text: options[0], onPress: () => handle(0) },
        { text: options[1], onPress: () => handle(1) },
        { text: options[2], style: 'destructive', onPress: () => handle(2) },
        { text: options[3], onPress: () => handle(3) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const goToSeller = () => (isOwner ? router.push('/profile') : router.push(`/user/${product.seller.id}`));

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
      >
        <ImageGallery urls={product.images.map((i) => i.url)} />

        <Animated.View entering={FadeIn.duration(220)} style={styles.content}>
          {(sold || reserved) && (
            <View style={styles.soldBanner}>
              <Ionicons name={reserved ? 'time-outline' : 'bag-check-outline'} size={17} color={colors.text} />
              <Text style={styles.soldText}>
                {reserved
                  ? isOwner
                    ? 'Someone ordered this item. Confirm it in Orders.'
                    : 'Reserved: someone has ordered this item'
                  : isOwner
                    ? 'You marked this item as sold'
                    : 'This item has been sold'}
              </Text>
            </View>
          )}

          <Text style={styles.title}>{product.title}</Text>
          <Text style={[type.priceLarge, sold && styles.soldPrice]}>{formatPrice(product.price)}</Text>

          <View style={styles.pills}>
            <Pill label={`Size ${product.size}`} />
            <Pill label={product.condition} />
            <Pill label={product.category} />
          </View>
          {isOwner && !sold && !reserved && (
            <Pressable
              onPress={() => router.push(`/promote/${product.id}`)}
              style={({ pressed }) => [styles.boost, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Boost this listing to the Home slideshow"
            >
              <View style={styles.boostIcon}>
                <Ionicons name="rocket-outline" size={20} color={colors.white} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.boostTitle}>Boost this listing</Text>
                <Text style={styles.boostBody}>Feature it at the top of Home from €1.99</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push(`/live-view/${product.id}`)}
            style={({ pressed }) => [styles.liveView, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="Live view: see how it fits your body"
          >
            <View style={styles.liveIcon}>
              <Ionicons name="body-outline" size={20} color={colors.white} />
            </View>
            <View style={styles.flex}>
              <Text style={type.bodyStrong}>Live view</Text>
              <Text style={type.footnote}>See how size {product.size} fits your body</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
          <Text style={type.footnote}>
            Listed {timeAgo(product.created_at)} · {product.favorites_count} {product.favorites_count === 1 ? 'save' : 'saves'}
          </Text>

          <View style={styles.divider} />

          <Text style={type.overline}>Description</Text>
          <Text style={[type.body, styles.description]}>{product.description.trim() || 'The seller hasn’t added a description.'}</Text>

          <View style={styles.divider} />

          <Text style={type.overline}>Seller</Text>
          <Pressable onPress={goToSeller} style={({ pressed }) => [styles.seller, pressed && { opacity: 0.6 }]} accessibilityRole="button">
            <Avatar uri={product.seller.profile_image} name={product.seller.username} size={44} />
            <View style={styles.flex}>
              <Text style={type.bodyStrong}>{product.seller.username}</Text>
              <Text style={type.footnote}>{isOwner ? 'This is your listing' : 'View profile and other items'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      {back}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {isOwner ? (
          reserved ? (
            <Button title="Manage order" icon="receipt-outline" variant="secondary" style={styles.flex} onPress={() => router.push('/orders')} />
          ) : (
            <>
              <Button
                title={sold ? 'Mark available' : 'Mark as sold'}
                icon={sold ? 'refresh-outline' : 'checkmark-done-outline'}
                variant="secondary"
                style={styles.flex}
                loading={busy === 'status'}
                onPress={toggleSold}
              />
              <Button title="Edit" variant="outline" onPress={() => router.push(`/product/edit/${product.id}`)} />
              <Button title="" icon="ellipsis-horizontal" variant="outline" accessibilityLabel="More options" loading={busy === 'delete'} onPress={ownerMenu} />
            </>
          )
        ) : (
          <>
            <FavoriteButton product={product} variant="bar" />
            <Button
              title=""
              icon="chatbubble-outline"
              variant="outline"
              accessibilityLabel="Message seller"
              onPress={messageSeller}
              loading={busy === 'message'}
            />
            <Button
              title={sold ? 'Sold' : reserved ? 'Reserved' : inBasket ? 'In basket' : 'Add to basket'}
              icon={sold || reserved ? undefined : inBasket ? 'bag-check-outline' : 'bag-add-outline'}
              variant={inBasket && !sold && !reserved ? 'secondary' : 'primary'}
              style={styles.flex}
              onPress={() => {
                if (inBasket) {
                  router.push('/basket');
                  return;
                }
                basket.add(product);
                void haptic.success();
                setAddedOpen(true);
              }}
              disabled={sold || reserved}
              accessibilityLabel={inBasket ? 'In basket. Open basket' : 'Add to basket'}
            />
            {user?.role === 'admin' && (
              <Button title="" icon="trash-outline" variant="danger" accessibilityLabel="Remove listing (admin)" loading={busy === 'delete'} onPress={deleteListing} />
            )}
          </>
        )}
      </View>

      <PromoPopup
        visible={boostPromptOpen && isOwner}
        eyebrow="Your item is live 🎉"
        title="Want more buyers to see it?"
        body="Boost it to the Featured slideshow at the top of Home, where every shopper starts. From €1.99."
        image={product.images[0]?.url ?? null}
        primaryLabel="Boost my listing"
        secondaryLabel="Maybe later"
        onPrimary={() => {
          setBoostPromptOpen(false);
          router.push(`/promote/${product.id}`);
        }}
        onClose={() => setBoostPromptOpen(false)}
      />

      <AddedToBasketSheet
        visible={addedOpen}
        product={product}
        count={basket.count}
        onClose={() => setAddedOpen(false)}
        onGoToBasket={() => {
          setAddedOpen(false);
          router.push('/basket');
        }}
      />
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: GUTTER - 4, right: GUTTER - 4, flexDirection: 'row', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', gap: spacing.sm },
  boost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  boostIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostTitle: { fontSize: fs(16), fontWeight: '700', color: colors.white },
  boostBody: { fontSize: fs(13), color: colors.white, opacity: 0.85 },
  content: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.sm },
  soldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.fill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  soldText: { ...type.callout, color: colors.text, fontWeight: '500' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(24), lineHeight: fs(30), letterSpacing: -0.3, color: colors.text },
  soldPrice: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.xs },
  pill: { backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pillText: { fontSize: fs(13), fontWeight: '600', color: colors.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.lg },
  description: { marginTop: spacing.xs },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  liveView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    marginVertical: spacing.sm,
  },
  liveIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    ...shadow.card,
  },
  }),
);
