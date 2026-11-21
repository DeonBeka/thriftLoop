import type { TextInputInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countActiveFilters, DEFAULT_FILTERS, FilterSheet, type ExploreFilters } from '@/components/explore/FilterSheet';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Chip } from '@/components/ui/Chip';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { CATEGORIES, PRICE_RANGES, SORT_OPTIONS } from '@/constants/catalog';
import { colors, font, radius, spacing } from '@/constants/theme';
import { productsApi } from '@/services/api';
import type { Category, Product, SortOption } from '@/types';
import { formatPrice } from '@/utils/format';

const PAGE = 20;

export default function Explore() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; sort?: string; focus?: string }>();
  const searchRef = useRef<TextInputInstance>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
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

  // Deep links from Home (category tile, "View all", search bar).
  useEffect(() => {
    if (params.category) setCategory(params.category as Category);
    if (params.sort) setFilters((f) => ({ ...f, sort: params.sort as SortOption }));
    if (params.focus) setTimeout(() => searchRef.current?.focus(), 300);
  }, [params.category, params.sort, params.focus]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number) =>
      productsApi.list({
        q: debounced,
        category,
        sizes: filters.sizes,
        conditions: filters.conditions,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
        limit: PAGE,
        offset,
      }),
    [debounced, category, filters],
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
      // silently ignore; user can scroll again
    } finally {
      setLoadingMore(false);
    }
  };

  const activeCount = countActiveFilters(filters);
  const clearAll = () => {
    setQuery('');
    setCategory(null);
    setFilters(DEFAULT_FILTERS);
  };

  const activeLabels: { key: string; label: string; remove: () => void }[] = [
    ...(filters.sort !== 'newest'
      ? [{ key: 'sort', label: SORT_OPTIONS.find((s) => s.value === filters.sort)!.label, remove: () => setFilters((f) => ({ ...f, sort: 'newest' })) }]
      : []),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? [
          {
            key: 'price',
            label:
              PRICE_RANGES.find((r) => (r.min ?? null) === filters.minPrice && (r.max ?? null) === filters.maxPrice)?.label ??
              `${filters.minPrice != null ? formatPrice(filters.minPrice) : '€0'}–${filters.maxPrice != null ? formatPrice(filters.maxPrice) : 'any'}`,
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.name} label={c.name} selected={category === c.name} onPress={() => setCategory(category === c.name ? null : c.name)} />
        ))}
      </ScrollView>
      {activeLabels.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {activeLabels.map((a) => (
            <Chip key={a.key} label={a.label} selected removable onPress={a.remove} />
          ))}
        </ScrollView>
      )}
      <View style={styles.resultsRow}>
        <Text style={styles.results}>
          {loading ? 'Searching…' : `${total} ${total === 1 ? 'item' : 'items'}`}
        </Text>
        {(activeCount > 0 || category || query) && (
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Explore</Text>
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            onSubmitEditing={() => setDebounced(query)}
          />
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.filterButton, activeCount > 0 && styles.filterActive, pressed && { opacity: 0.8 }]}
          accessibilityLabel="Filters"
        >
          <Ionicons name="options-outline" size={20} color={activeCount > 0 ? colors.white : colors.text} />
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {loading && !items.length ? (
        <>
          <View style={styles.bleedFix}>{header}</View>
          <LoadingView />
        </>
      ) : error && !items.length ? (
        <>
          <View style={styles.bleedFix}>{header}</View>
          <ErrorState message={error} onRetry={() => load('initial')} />
        </>
      ) : (
        <ProductGrid
          products={items}
          header={header}
          refreshing={refreshing}
          onRefresh={() => load('refresh')}
          onEndReached={loadMore}
          footer={loadingMore ? <ActivityIndicator style={{ marginVertical: spacing.xl }} color={colors.primary} /> : null}
          empty={
            <EmptyState
              icon="search-outline"
              title="No matches"
              message="Try a different search or loosen your filters."
              actionLabel="Clear filters"
              onAction={clearAll}
            />
          }
        />
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: font.size.display,
    fontWeight: font.weight.heavy,
    color: colors.text,
    letterSpacing: -0.8,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: font.weight.bold, color: colors.primary },
  headerBlock: { gap: spacing.md, marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  bleedFix: { paddingHorizontal: spacing.lg },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  results: { fontSize: font.size.sm, color: colors.textSecondary, fontWeight: font.weight.medium },
  clear: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.weight.semibold },
});
