import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GRID_PADDING, ProductGrid } from '@/components/product/ProductGrid';
import { ProductGridSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useFavorites } from '@/hooks/useFavorites';
import { favoritesApi } from '@/services/api';

export default function Favorites() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, version } = useFavorites();
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => favoritesApi.list(), [], {
    refetchOnFocus: true,
  });

  // Re-sync when a heart is toggled anywhere in the app.
  const firstVersion = useRef(version);
  useEffect(() => {
    if (version !== firstVersion.current) void reload();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un-hearted items fade out immediately, before the refetch lands.
  const items = (data ?? []).filter((p) => isFavorite(p));
  const soldCount = items.filter((p) => p.status === 'sold').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={type.largeTitle}>Favorites</Text>
        <Text style={type.footnote}>
          {loading
            ? ' '
            : items.length
              ? `${items.length} saved${soldCount ? ` · ${soldCount} sold` : ''} · only you can see these`
              : 'Only you can see the items you save'}
        </Text>
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ProductGrid
          products={loading ? [] : items}
          refreshing={refreshing}
          onRefresh={refresh}
          animateChanges
          empty={
            loading ? (
              <ProductGridSkeleton count={4} />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="Save what you love"
                message="Tap the heart on any item and it'll wait for you here. Items that get deleted disappear automatically."
                actionLabel="Start exploring"
                onAction={() => router.push('/explore')}
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: GRID_PADDING, marginBottom: spacing.lg, gap: 2 },
});
