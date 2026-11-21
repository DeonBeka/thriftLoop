import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/product/FavoriteButton';
import { ImageGallery } from '@/components/product/ImageGallery';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ErrorState, LoadingView } from '@/components/ui/States';
import { colors, font, radius, shadow, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { messagesApi, productsApi } from '@/services/api';
import { formatPrice, timeAgo } from '@/utils/format';

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

  const topBar = (
    <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" label="Back" floating onPress={() => router.back()} />
      {product && <FavoriteButton product={product} size="lg" />}
    </View>
  );

  if (loading) return <LoadingView />;
  if (error || !product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ErrorState message={error ?? 'This listing no longer exists.'} onRetry={reload} />
        {topBar}
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
      void refreshUser();
    } catch (err) {
      Alert.alert("Couldn't update listing", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
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

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <ImageGallery urls={product.images.map((i) => i.url)} />

        <Animated.View entering={FadeInUp.duration(350)} style={styles.sheet}>
          {sold && (
            <View style={styles.soldBanner}>
              <Ionicons name="bag-check-outline" size={18} color={colors.white} />
              <Text style={styles.soldText}>This item has been sold</Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            <Text style={styles.meta}>
              {timeAgo(product.created_at)} · {product.favorites_count} {product.favorites_count === 1 ? 'save' : 'saves'}
            </Text>
          </View>
          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.details}>
            <Detail label="Category" value={product.category} />
            <Detail label="Size" value={product.size} />
            <Detail label="Condition" value={product.condition} />
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          <Text style={styles.sectionTitle}>Seller</Text>
          <Pressable
            onPress={() => (isOwner ? router.push('/profile') : router.push(`/user/${product.seller.id}`))}
            style={({ pressed }) => [styles.seller, pressed && { opacity: 0.85 }]}
          >
            <Avatar uri={product.seller.profile_image} name={product.seller.username} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{product.seller.username}</Text>
              <Text style={styles.sellerLink}>{isOwner ? 'This is your listing' : 'View profile & other items'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      {topBar}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {isOwner ? (
          <View style={styles.ownerActions}>
            <Button
              title="Edit"
              icon="create-outline"
              variant="outline"
              size="md"
              style={{ flex: 1 }}
              onPress={() => router.push(`/product/edit/${product.id}`)}
            />
            <Button
              title={sold ? 'Mark available' : 'Mark sold'}
              icon={sold ? 'refresh-outline' : 'checkmark-done-outline'}
              variant="secondary"
              size="md"
              style={{ flex: 1.3 }}
              loading={busy === 'status'}
              onPress={toggleSold}
            />
            <Button title="" icon="trash-outline" variant="danger" size="md" loading={busy === 'delete'} onPress={confirmDelete} />
          </View>
        ) : (
          <Button
            title={sold ? 'Sold' : 'Message seller'}
            icon="chatbubble-ellipses-outline"
            onPress={messageSeller}
            loading={busy === 'message'}
            disabled={sold}
          />
        )}
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheet: {
    marginTop: -spacing.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  soldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  soldText: { color: colors.white, fontWeight: font.weight.semibold },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  price: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  meta: { fontSize: font.size.sm, color: colors.textSecondary },
  title: { fontSize: font.size.xl, fontWeight: font.weight.semibold, color: colors.text, marginTop: -spacing.xs },
  details: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  detail: { flex: 1, gap: 2 },
  detailLabel: { fontSize: font.size.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.semibold },
  sectionTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, marginTop: spacing.md },
  description: { fontSize: font.size.md, lineHeight: 23, color: colors.text },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  sellerName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  sellerLink: { fontSize: font.size.sm, color: colors.primary, marginTop: 2 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  ownerActions: { flexDirection: 'row', gap: spacing.sm },
});
