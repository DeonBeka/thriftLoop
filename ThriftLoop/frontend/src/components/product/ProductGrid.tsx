import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import type { Product } from '@/types';

import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  footer?: ReactElement | null;
  onEndReached?: () => void;
  scrollEnabled?: boolean;
  bottomInset?: number;
}

export const GRID_GAP = spacing.md;
export const GRID_PADDING = spacing.lg;

export function useCardWidth() {
  const { width } = useWindowDimensions();
  return (width - GRID_PADDING * 2 - GRID_GAP) / 2;
}

/** Two-column, pull-to-refresh product grid. */
export function ProductGrid({
  products,
  refreshing = false,
  onRefresh,
  header,
  empty,
  footer,
  onEndReached,
  scrollEnabled = true,
  bottomInset = spacing.xxl,
}: ProductGridProps) {
  const cardWidth = useCardWidth();
  return (
    <FlatList
      data={products}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={footer ?? undefined}
      ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      scrollEnabled={scrollEnabled}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GRID_PADDING, flexGrow: 1 },
  row: { gap: GRID_GAP },
});
