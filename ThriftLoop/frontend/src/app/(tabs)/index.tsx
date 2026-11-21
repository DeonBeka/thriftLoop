import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { GRID_GAP, GRID_PADDING, useCardWidth } from '@/components/product/ProductGrid';
import { ProductImage } from '@/components/product/ProductImage';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { SearchBar } from '@/components/ui/SearchBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { CATEGORIES } from '@/constants/catalog';
import { colors, font, radius, shadow, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { productsApi } from '@/services/api';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const unread = useUnreadCount();
  const { ids: favoriteIds } = useFavorites();
  const cardWidth = useCardWidth();
  const { width } = useWindowDimensions();

  const { data, error, loading, refreshing, refresh, reload } = useApi(
    async () => {
      const [featured, recent, all] = await Promise.all([
        productsApi.list({ sort: 'popular', limit: 6, excludeOwn: true }),
        productsApi.list({ sort: 'newest', limit: 8 }),
        productsApi.list({ sort: 'newest', limit: 40, excludeOwn: true }),
      ]);
      return { featured: featured.items, recent: recent.items, all: all.items };
    },
    [],
    { refetchOnFocus: true },
  );

  // "Picked for you": favour categories the shopper already saves/browses, else newest.
  const recommended = useMemo<Product[]>(() => {
    if (!data) return [];
    const liked = new Set(data.all.filter((p) => favoriteIds.has(p.id)).map((p) => p.category));
    const seen = new Set([...data.featured, ...data.recent].map((p) => p.id));
    return data.all
      .filter((p) => !seen.has(p.id) && !favoriteIds.has(p.id))
      .sort((a, b) => Number(liked.has(b.category)) - Number(liked.has(a.category)))
      .slice(0, 10);
  }, [data, favoriteIds]);

  const openCategory = (category: string) => router.push({ pathname: '/explore', params: { category } });

  if (loading) return <LoadingView />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Logo size={22} />
        <IconButton icon="chatbubble-ellipses-outline" label="Messages" badge={unread} onPress={() => router.push('/messages')} />
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={styles.welcome}>
        <Text style={styles.greeting}>
          {greeting()}, {user?.username}
        </Text>
        <Text style={styles.headline}>Find your next favourite piece</Text>
      </Animated.View>

      <View style={styles.padded}>
        <SearchBar onPressFake={() => router.push({ pathname: '/explore', params: { focus: '1' } })} />
      </View>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <View style={styles.section}>
            <View style={styles.padded}>
              <SectionHeader title="Popular categories" action="See all" onAction={() => router.push('/explore')} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.name}
                  onPress={() => openCategory(c.name)}
                  style={({ pressed }) => [styles.category, { backgroundColor: c.tint }, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryText}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {!!data?.featured.length && (
            <View style={styles.section}>
              <View style={styles.padded}>
                <SectionHeader title="Featured" />
              </View>
              <FlatList
                data={data.featured}
                horizontal
                keyExtractor={(p) => String(p.id)}
                showsHorizontalScrollIndicator={false}
                snapToInterval={width * 0.72 + spacing.md}
                decelerationRate="fast"
                contentContainerStyle={styles.featuredList}
                renderItem={({ item }) => <FeaturedCard product={item} width={width * 0.72} />}
              />
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.padded}>
              <SectionHeader
                title="Recently added"
                action="View all"
                onAction={() => router.push({ pathname: '/explore', params: { sort: 'newest' } })}
              />
            </View>
            {data?.recent.length ? (
              <FlatList
                data={data.recent}
                horizontal
                keyExtractor={(p) => String(p.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCards}
                renderItem={({ item }) => <ProductCard product={item} width={cardWidth * 0.9} />}
              />
            ) : (
              <EmptyState
                icon="shirt-outline"
                title="No listings yet"
                message="Be the first to list something!"
                actionLabel="Sell an item"
                onAction={() => router.push('/sell')}
              />
            )}
          </View>

          {recommended.length > 0 && (
            <View style={[styles.section, styles.padded]}>
              <SectionHeader title="Picked for you" />
              <View style={styles.grid}>
                {recommended.map((p) => (
                  <ProductCard key={p.id} product={p} width={cardWidth} />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function FeaturedCard({ product, width }: { product: Product; width: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.featured, { width }, pressed && styles.pressed]}
    >
      <ProductImage uri={product.images[0]?.url} style={{ width, height: width * 0.95 }} />
      <View style={styles.featuredOverlay}>
        <View style={{ flex: 1 }}>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={styles.featuredMeta}>
            {product.size} · {product.condition}
          </Text>
        </View>
        <Text style={styles.featuredPrice}>{formatPrice(product.price)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: GRID_PADDING,
    marginBottom: spacing.lg,
  },
  welcome: { paddingHorizontal: GRID_PADDING, marginBottom: spacing.lg, gap: 2 },
  greeting: { fontSize: font.size.md, color: colors.textSecondary },
  headline: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.6 },
  padded: { paddingHorizontal: GRID_PADDING },
  section: { marginTop: spacing.xxl },
  categories: { paddingHorizontal: GRID_PADDING, gap: spacing.sm },
  category: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  categoryText: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  featuredList: { paddingHorizontal: GRID_PADDING, gap: spacing.md },
  featured: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, ...shadow.card },
  featuredOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  featuredTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  featuredMeta: { fontSize: font.size.sm, color: colors.textSecondary, marginTop: 2 },
  featuredPrice: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.primary },
  horizontalCards: { paddingHorizontal: GRID_PADDING, gap: spacing.md, paddingBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});
