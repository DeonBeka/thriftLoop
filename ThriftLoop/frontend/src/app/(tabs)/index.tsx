import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { GRID_PADDING, ProductGrid } from '@/components/product/ProductGrid';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { GroupTabs } from '@/components/home/GroupTabs';
import { SellBanner } from '@/components/home/SellBanner';
import { HomeSkeleton, LoadMoreSkeleton, ProductGridSkeleton } from '@/components/skeletons';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { SearchBar } from '@/components/ui/SearchBar';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { GROUPS } from '@/constants/catalog';
import { colors, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useBasket } from '@/hooks/useBasket';
import { useFavorites } from '@/hooks/useFavorites';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { productsApi } from '@/services/api';
import type { Category, Group, Product } from '@/types';

const groupLabel = (g: Group) => GROUPS.find((x) => x.id === g)?.label ?? g;

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
  const basket = useBasket();
  const { ids: favoriteIds } = useFavorites();

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
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
      return productsApi.list({ sort: 'newest', group, category, limit: PAGE, excludeOwn: true });
    },
    [group, category],
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
      const res = await productsApi.list({ sort: 'newest', group, category, limit: PAGE, offset: items.length, excludeOwn: true });
      setExtra((prev) => [...prev, ...res.items]);
    } catch {
      // keep what we have; the next scroll retries
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, feed.loading, items.length, total, group, category]);

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
        <Logo size={24} />
        <View style={styles.topActions}>
          <IconButton icon="sparkles-outline" label="Ask the AI shopping assistant" onPress={() => router.push('/assistant')} />
          <IconButton icon="bag-outline" label="Basket" badge={basket.count} onPress={() => router.push('/basket')} />
          <IconButton icon="chatbubble-outline" label="Messages" badge={unread} onPress={() => router.push('/messages')} />
        </View>
      </View>

      <Text style={styles.greeting}>
        {greeting()}, {user?.username}
      </Text>
      <Text style={styles.headline}>What are you looking for today?</Text>

      <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} onSubmitEditing={search} />

      <AskAiButton onPress={() => router.push('/assistant')} />

      <View style={styles.groups}>
        <GroupTabs
          value={group}
          onChange={(g) => {
            setGroup(g);
            setCategory(null);
          }}
        />
      </View>

      <View style={styles.categories}>
        <CategoryTiles group={group} selected={category} onSelect={setCategory} />
      </View>

      {!category && !group && (
        <View style={styles.banner}>
          <SellBanner onPress={() => router.push('/sell')} />
        </View>
      )}

      {!category && !group && picks.length > 0 && (
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
          title={category ?? (group ? groupLabel(group) : 'Just in')}
          action={category || group ? `${total} ${total === 1 ? 'item' : 'items'}` : 'View all'}
          onAction={category || group ? undefined : () => router.push({ pathname: '/explore', params: { sort: 'newest' } })}
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
        footer={loadingMore ? <LoadMoreSkeleton /> : null}
        empty={
          feed.loading ? (
            <ProductGridSkeleton count={4} />
          ) : feed.error ? (
            <ErrorState message={feed.error} onRetry={feed.reload} />
          ) : (
            <EmptyState
              icon="shirt-outline"
              title={category ? `No ${category.toLowerCase()} yet` : group ? `No ${groupLabel(group).toLowerCase()} yet` : 'Nothing listed yet'}
              message={category ? 'Check back soon, or be the first to list one.' : 'Be the first to list something.'}
              actionLabel="Sell an item"
              onAction={() => router.push('/sell')}
              secondaryLabel={category || group ? 'Show everything' : undefined}
              onSecondary={
                category || group
                  ? () => {
                      setCategory(null);
                      setGroup(null);
                    }
                  : undefined
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginRight: -spacing.sm,
  },
  greeting: { ...type.footnote, marginTop: spacing.xs },
  headline: { ...type.display, marginTop: 2, marginBottom: spacing.lg },
  groups: { marginTop: spacing.lg },
  categories: { marginTop: spacing.md },
  topActions: { flexDirection: 'row', gap: spacing.xs },
  banner: { marginTop: spacing.xl },
  section: { marginTop: spacing.xxl },
  bleed: { marginHorizontal: -GRID_PADDING },
  picks: { paddingHorizontal: GRID_PADDING, gap: spacing.md },
  }),
);
