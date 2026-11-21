import type { ReactElement } from 'react';
import { RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, GUTTER, spacing } from '@/constants/theme';
import type { Product } from '@/types';

import { IMAGE_RATIO, ProductCard } from './ProductCard';

export { IMAGE_RATIO };
export const GRID_GAP = spacing.md;
export const GRID_PADDING = GUTTER;

export function useCardWidth() {
  const { width } = useWindowDimensions();
  // Floor to whole pixels so both columns line up exactly on every iPhone width.
  return Math.floor((width - GRID_PADDING * 2 - GRID_GAP) / 2);
}

interface ProductGridProps {
  products: Product[];
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  footer?: ReactElement | null;
  onEndReached?: () => void;
  bottomInset?: number;
  /** Fade cards out when they leave the list (e.g. un-favorited). */
  animateChanges?: boolean;
}

/** Two-column, pull-to-refresh photo grid used by Home, Explore, Favorites and profiles. */
export function ProductGrid({
  products,
  refreshing = false,
  onRefresh,
  header,
  empty,
  footer,
  onEndReached,
  bottomInset = spacing.xxxl,
  animateChanges = false,
}: ProductGridProps) {
  const cardWidth = useCardWidth();
  return (
    <Animated.FlatList
      data={products}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      renderItem={({ item }) =>
        animateChanges ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)}>
            <ProductCard product={item} width={cardWidth} />
          </Animated.View>
        ) : (
          <ProductCard product={item} width={cardWidth} />
        )
      }
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={footer ?? undefined}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      removeClippedSubviews
      initialNumToRender={6}
      windowSize={7}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} /> : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GRID_PADDING, flexGrow: 1 },
  row: { gap: GRID_GAP, marginBottom: spacing.xl },
});
