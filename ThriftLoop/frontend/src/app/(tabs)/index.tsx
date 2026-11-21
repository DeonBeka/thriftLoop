import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { GRID_PADDING, ProductGrid } from '@/components/product/ProductGrid';
import { HomeSkeleton, ProductGridSkeleton } from '@/components/skeletons';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { SearchBar } from '@/components/ui/SearchBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { CATEGORIES } from '@/constants/catalog';
import { colors, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { productsApi } from '@/services/api';
import type { Category, Product } from '@/types';

const PAGE = 20;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const unread = useUnreadCount();
  const { ids: favoriteIds } = useFavorites();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [extra, setExtra] = useState<Product[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstLoad = useRef(true);

  // "Popular" row is fetched once; the grid re-fetches when the category changes.
  const popular = useApi(() => productsApi.list({ sort: 'popular', limit: 12, excludeOwn: true }), [], {
    refetchOnFocus: true,
  });
  const feed = useApi(
    async () => {
      setExtra([]);
      return productsApi.list({ sort: 'newest', category, limit: PAGE, excludeOwn: true });
    },
    [category],
    { refetchOnFocus: true },
  );

  const items = useMemo(() => {
    const base = feed.data?.items ?? [];
    const seen = new Set(base.map((p) => p.id));
    return [...base, ...extra.filter((p) => !seen.has(p.id))];
  }, [feed.data, extra]);
  const total = feed.data?.total ?? 0;

  // Favour the categories this shopper saves; fall back to plain popularity.
  const picks = useMemo(() => {
    const list = popular.data?.items ?? [];
    const liked = new Set(list.filter((p) => favoriteIds.has(p.id)).map((p) => p.category));
    return [...list]
      .filter((p) => !favoriteIds.has(p.id))
      .sort((a, b) => Number(liked.has(b.category)) - Number(liked.has(a.category)))
      .slice(0, 8);
  }, [popular.data, favoriteIds]);

  const loadMore = useCallback(async () => {
    if (loadingMore || feed.loading || items.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await productsApi.list({ sort: 'newest', category, limit: PAGE, offset: items.length, excludeOwn: true });
      setExtra((prev) => [...prev, ...res.items]);
    } catch {
      // keep what we have; the next scroll retries
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, feed.loading, items.length, total, category]);

  const refresh = async () => {
    await Promise.all([feed.refresh(), popular.reload()]);
  };

  const search = () => {
    const q = query.trim();
    if (!q) return;
    router.push({ pathname: '/explore', params: { q } });
  };

  // Full skeleton only on the very first load; afterwards keep the header and skeleton just the grid.
  if (firstLoad.current && feed.loading && !feed.data) return <HomeSkeleton />;
  firstLoad.current = false;

  const picksWidth = Math.min(168, width * 0.42);

  const header = (
    <View>
      <View style={styles.topBar}>
        <Logo size={21} />
        <IconButton icon="chatbubble-outline" label="Messages" badge={unread} onPress={() => router.push('/messages')} />
      </View>

      <Text style={styles.greeting}>
        {greeting()}, {user?.username}
      </Text>

      <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} onSubmitEditing={search} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroller}
        contentContainerStyle={styles.categories}
      >
        <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.name} label={c.name} selected={category === c.name} onPress={() => setCategory(category === c.name ? null : c.name)} />
        ))}
      </ScrollView>

      {!category && picks.length > 0 && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.section}>
          <SectionHeader
            title={favoriteIds.size ? 'Picked for you' : 'Popular right now'}
            action="See all"
            onAction={() => router.push({ pathname: '/explore', params: { sort: 'popular' } })}
          />
          <FlatList
            data={picks}
            horizontal
            keyExtractor={(p) => String(p.id)}
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.picks}
            renderItem={({ item }) => <ProductCard product={item} width={picksWidth} />}
          />
        </Animated.View>
      )}

      <View style={styles.section}>
        <SectionHeader
          title={category ?? 'Just in'}
          action={category ? `${total} ${total === 1 ? 'item' : 'items'}` : 'View all'}
          onAction={category ? undefined : () => router.push({ pathname: '/explore', params: { sort: 'newest' } })}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ProductGrid
        products={feed.loading ? [] : items}
        header={header}
        refreshing={feed.refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        footer={loadingMore ? <LoadingView /> : null}
        empty={
          feed.loading ? (
            <ProductGridSkeleton count={4} />
          ) : feed.error ? (
            <ErrorState message={feed.error} onRetry={feed.reload} />
          ) : (
            <EmptyState
              icon="shirt-outline"
              title={category ? `No ${category.toLowerCase()} yet` : 'Nothing listed yet'}
              message={category ? 'Check back soon, or be the first to list one.' : 'Be the first to list something.'}
              actionLabel="Sell an item"
              onAction={() => router.push('/sell')}
              secondaryLabel={category ? 'Show everything' : undefined}
              onSecondary={category ? () => setCategory(null) : undefined}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginRight: -spacing.sm,
  },
  greeting: { ...type.footnote, marginTop: spacing.xs, marginBottom: spacing.md },
  categoriesScroller: { marginHorizontal: -GRID_PADDING, marginTop: spacing.md },
  categories: { paddingHorizontal: GRID_PADDING, gap: spacing.sm },
  section: { marginTop: spacing.xxl },
  bleed: { marginHorizontal: -GRID_PADDING },
  picks: { paddingHorizontal: GRID_PADDING, gap: spacing.md },
});
