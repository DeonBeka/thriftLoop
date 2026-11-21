import type { TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countActiveFilters, DEFAULT_FILTERS, FilterSheet, type ExploreFilters } from '@/components/explore/FilterSheet';
import { GRID_PADDING, ProductGrid } from '@/components/product/ProductGrid';
import { LoadMoreSkeleton, ProductGridSkeleton } from '@/components/skeletons';
import { Chip } from '@/components/ui/Chip';
import { PressableScale } from '@/components/ui/PressableScale';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { GroupTabs } from '@/components/home/GroupTabs';
import { categoriesInGroup, PRICE_RANGES, SORT_OPTIONS } from '@/constants/catalog';
import { colors, control, fs, radius, spacing, themed, type } from '@/constants/theme';
import { productsApi } from '@/services/api';
import type { Category, Group, Product, SortOption } from '@/types';
import { formatPrice } from '@/utils/format';

const PAGE = 20;

export default function Explore() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; group?: string; sort?: string; q?: string; focus?: string }>();
  const searchRef = useRef<TextInputInstance>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Deep links from Home: search text, "See all" sorts, category.
  useEffect(() => {
    if (params.group) setGroup(params.group as Group);
    if (params.category) setCategory(params.category as Category);
    if (params.sort) setFilters((f) => ({ ...f, sort: params.sort as SortOption }));
    if (params.q !== undefined) {
      setQuery(params.q);
      setDebounced(params.q);
    }
    if (params.focus) setTimeout(() => searchRef.current?.focus(), 350);
  }, [params.group, params.category, params.sort, params.q, params.focus]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    (offset: number) =>
      productsApi.list({
        q: debounced,
        group,
        category,
        sizes: filters.sizes,
        conditions: filters.conditions,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
        limit: PAGE,
        offset,
      }),
    [debounced, group, category, filters],
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetchPage(0);
        if (id !== requestId.current) return;
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || loading || items.length >= total) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const res = await fetchPage(items.length);
      if (id === requestId.current) setItems((prev) => [...prev, ...res.items.filter((p) => !prev.some((x) => x.id === p.id))]);
    } catch {
      // ignore; scrolling again retries
    } finally {
      setLoadingMore(false);
    }
  };

  const activeCount = countActiveFilters(filters);
  const hasAnything = activeCount > 0 || !!category || !!group || !!query;
  const clearAll = () => {
    setQuery('');
    setDebounced('');
    setCategory(null);
    setGroup(null);
    setFilters(DEFAULT_FILTERS);
  };

  const activeLabels: { key: string; label: string; remove: () => void }[] = [
    ...(filters.sort !== 'newest'
      ? [{ key: 'sort', label: SORT_OPTIONS.find((s) => s.value === filters.sort)!.label, remove: () => setFilters((f) => ({ ...f, sort: 'newest' as SortOption })) }]
      : []),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? [
          {
            key: 'price',
            label:
              PRICE_RANGES.find((r) => (r.min ?? null) === filters.minPrice && (r.max ?? null) === filters.maxPrice)?.label ??
              `${filters.minPrice != null ? formatPrice(filters.minPrice) : '€0'} – ${filters.maxPrice != null ? formatPrice(filters.maxPrice) : 'any'}`,
            remove: () => setFilters((f) => ({ ...f, minPrice: null, maxPrice: null })),
          },
        ]
      : []),
    ...filters.conditions.map((c) => ({
      key: `c-${c}`,
      label: c,
      remove: () => setFilters((f) => ({ ...f, conditions: f.conditions.filter((x) => x !== c) })),
    })),
    ...filters.sizes.map((s) => ({
      key: `s-${s}`,
      label: `Size ${s}`,
      remove: () => setFilters((f) => ({ ...f, sizes: f.sizes.filter((x) => x !== s) })),
    })),
  ];

  const header = (
    <View style={styles.headerBlock}>
      <GroupTabs
        value={group}
        onChange={(g) => {
          setGroup(g);
          setCategory(null);
        }}
      />
      {categoriesInGroup(group).length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {categoriesInGroup(group).map((c) => (
            <Chip
              key={c.name}
              label={c.name}
              selected={category === c.name}
              onPress={() => setCategory(category === c.name ? null : c.name)}
            />
          ))}
        </ScrollView>
      )}
      {activeLabels.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {activeLabels.map((a) => (
            <Chip key={a.key} label={a.label} selected removable onPress={a.remove} />
          ))}
        </ScrollView>
      )}
      <View style={styles.resultsRow}>
        <Text style={type.footnote}>
          {loading ? 'Searching…' : `${total} ${total === 1 ? 'result' : 'results'}${debounced ? ` for “${debounced}”` : ''}`}
        </Text>
        {hasAnything && (
          <Text style={styles.clear} onPress={clearAll} suppressHighlighting>
            Clear all
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <Text style={type.largeTitle}>Explore</Text>
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <SearchBar
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              onClear={() => {
                setQuery('');
                setDebounced('');
              }}
              onSubmitEditing={() => setDebounced(query)}
            />
          </View>
          <PressableScale
            onPress={() => setSheetOpen(true)}
            scaleTo={0.94}
            style={[styles.filterButton, activeCount > 0 && styles.filterActive]}
            accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
            accessibilityRole="button"
          >
            <Ionicons name="options-outline" size={20} color={activeCount > 0 ? colors.white : colors.text} />
            {activeCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeCount}</Text>
              </View>
            )}
          </PressableScale>
        </View>
      </View>

      <ProductGrid
        products={loading ? [] : items}
        header={header}
        refreshing={refreshing}
        onRefresh={() => load('refresh')}
        onEndReached={loadMore}
        footer={loadingMore ? <LoadMoreSkeleton /> : null}
        empty={
          loading ? (
            <ProductGridSkeleton count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load('initial')} />
          ) : (
            <EmptyState
              icon="search-outline"
              title={debounced ? `No results for “${debounced}”` : 'No matches'}
              message="Try another word, a different category or fewer filters."
              actionLabel={hasAnything ? 'Clear filters' : undefined}
              onAction={hasAnything ? clearAll : undefined}
            />
          )
        }
      />

      <FilterSheet
        visible={sheetOpen}
        initial={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { paddingHorizontal: GRID_PADDING, gap: spacing.md, paddingBottom: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  filterButton: {
    width: control.md,
    height: control.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: colors.primary },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.warm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  filterBadgeText: { fontSize: fs(10), fontWeight: '700', color: colors.white },
  headerBlock: { gap: spacing.md, marginBottom: spacing.lg },
  bleed: { marginHorizontal: -GRID_PADDING },
  chips: { gap: spacing.sm, paddingHorizontal: GRID_PADDING },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clear: { fontSize: fs(13), color: colors.primary, fontWeight: '600' },
  }),
);
