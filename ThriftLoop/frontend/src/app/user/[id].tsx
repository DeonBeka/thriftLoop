import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProductGrid } from '@/components/product/ProductGrid';
import { ProfileHeader, type ListingTab } from '@/components/profile/ProfileHeader';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { colors, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { usersApi } from '@/services/api';

export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const [tab, setTab] = useState<ListingTab>('active');

  const { data, error, loading, refreshing, refresh, reload } = useApi(
    async () => {
      const [profile, products] = await Promise.all([usersApi.get(userId), usersApi.products(userId, 'all')]);
      return { profile, products };
    },
    [userId],
    { refetchOnFocus: true },
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data?.profile.username ?? '' }} />
      {loading ? (
        <LoadingView />
      ) : error || !data ? (
        <ErrorState message={error ?? 'User not found.'} onRetry={reload} />
      ) : (
        <ProductGrid
          products={data.products.filter((p) => p.status === tab)}
          refreshing={refreshing}
          onRefresh={refresh}
          header={<ProfileHeader profile={data.profile} tab={tab} onTabChange={setTab} />}
          empty={
            <EmptyState
              icon={tab === 'active' ? 'pricetag-outline' : 'bag-check-outline'}
              title={tab === 'active' ? 'No active listings' : 'No sold items yet'}
              message={tab === 'active' ? `${data.profile.username} has nothing for sale right now.` : undefined}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.sm },
});
