import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/product/FavoriteButton';
import { ImageGallery } from '@/components/product/ImageGallery';
import { ProductDetailsSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ErrorState } from '@/components/ui/States';
import { colors, GUTTER, radius, shadow, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { messagesApi, productsApi } from '@/services/api';
import { formatPrice, timeAgo } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState<null | 'message' | 'status' | 'delete'>(null);

  const { data: product, error, loading, refreshing, refresh, reload, setData } = useApi(
    () => productsApi.get(Number(id)),
    [id],
    { refetchOnFocus: true },
  );

  const back = (
    <View style={[styles.topBar, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" label="Back" floating onPress={() => router.back()} />
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
    const options = ['Edit listing', sold ? 'Mark as available' : 'Mark as sold', 'Delete listing', 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) router.push(`/product/edit/${product.id}`);
      if (i === 1) void toggleSold();
      if (i === 2) deleteListing();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3, destructiveButtonIndex: 2 }, handle);
    } else {
      Alert.alert('Listing', undefined, [
        { text: options[0], onPress: () => handle(0) },
        { text: options[1], onPress: () => handle(1) },
        { text: options[2], style: 'destructive', onPress: () => handle(2) },
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
          {sold && (
            <View style={styles.soldBanner}>
              <Ionicons name="bag-check-outline" size={17} color={colors.text} />
              <Text style={styles.soldText}>{isOwner ? 'You marked this item as sold' : 'This item has been sold'}</Text>
            </View>
          )}

          <Text style={styles.title}>{product.title}</Text>
          <Text style={[type.priceLarge, sold && styles.soldPrice]}>{formatPrice(product.price)}</Text>

          <View style={styles.pills}>
            <Pill label={`Size ${product.size}`} />
            <Pill label={product.condition} />
            <Pill label={product.category} />
          </View>
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
        ) : (
          <>
            <FavoriteButton product={product} variant="bar" />
            <Button
              title={sold ? 'Sold' : 'Message seller'}
              icon={sold ? undefined : 'chatbubble-outline'}
              style={styles.flex}
              onPress={messageSeller}
              loading={busy === 'message'}
              disabled={sold}
            />
          </>
        )}
      </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: GUTTER - 4, right: GUTTER - 4, flexDirection: 'row', justifyContent: 'space-between' },
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
  title: { fontSize: 21, lineHeight: 27, fontWeight: '600', letterSpacing: -0.3, color: colors.text },
  soldPrice: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.xs },
  pill: { backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.lg },
  description: { marginTop: spacing.xs },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(248,248,246,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    ...shadow.card,
  },
});
