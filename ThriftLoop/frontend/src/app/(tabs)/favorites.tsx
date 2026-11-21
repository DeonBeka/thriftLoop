import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { colors, font, spacing } from '@/constants/theme';
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

  // Hide items un-hearted on this screen immediately (before the refetch lands).
  const items = (data ?? []).filter((p) => isFavorite(p));
  const soldCount = items.filter((p) => p.status === 'sold').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
        {items.length > 0 && (
          <Text style={styles.subtitle}>
            {items.length} saved{soldCount ? ` · ${soldCount} sold` : ''}
          </Text>
        )}
      </View>
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ProductGrid
          products={items}
          refreshing={refreshing}
          onRefresh={refresh}
          empty={
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              message="Tap the heart on any item to keep it here. Deleted listings are removed automatically."
              actionLabel="Start exploring"
              onAction={() => router.push('/explore')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg, gap: 2 },
  title: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: font.size.md, color: colors.textSecondary },
});
