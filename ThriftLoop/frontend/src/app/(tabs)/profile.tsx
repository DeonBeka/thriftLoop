import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GRID_PADDING, ProductGrid } from '@/components/product/ProductGrid';
import { ProfileHeader, type ListingTab } from '@/components/profile/ProfileHeader';
import { ProfileSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { usersApi } from '@/services/api';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { ids } = useFavorites();
  const unread = useUnreadCount();
  const [tab, setTab] = useState<ListingTab>('active');

  const { data, error, loading, refreshing, refresh, reload } = useApi(
    async () => {
      void refreshUser();
      return usersApi.products(user!.id, 'all');
    },
    [user?.id],
    { refetchOnFocus: true },
  );

  if (!user) return null;
  if (loading && !data) return <ProfileSkeleton withTopBar />;

  const listings = (data ?? []).filter((p) => p.status === tab);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topBar}>
        <Text style={type.largeTitle}>Profile</Text>
        <View style={styles.topActions}>
          <IconButton icon="chatbubble-outline" label="Messages" badge={unread} onPress={() => router.push('/messages')} />
          <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ProductGrid
          products={listings}
          refreshing={refreshing}
          onRefresh={refresh}
          header={
            <ProfileHeader
              profile={user}
              savedCount={ids.size}
              onPressSaved={() => router.push('/favorites')}
              tab={tab}
              onTabChange={setTab}
              actions={
                <>
                  <Button title="Edit profile" variant="outline" size="md" style={styles.flex} onPress={() => router.push('/profile/edit')} />
                  <Button
                    title={user.role === 'viewer' ? 'Become a seller' : 'Sell an item'}
                    variant="secondary"
                    size="md"
                    style={styles.flex}
                    onPress={() => router.push('/sell')}
                  />
                </>
              }
            />
          }
          empty={
            tab === 'active' ? (
              <EmptyState
                icon="pricetag-outline"
                title="No active listings"
                message="Turn the clothes you don't wear into cash. It takes about a minute."
                actionLabel="List an item"
                onAction={() => router.push('/sell')}
              />
            ) : (
              <EmptyState icon="bag-check-outline" title="Nothing sold yet" message="Items you mark as sold will show up here." />
            )
          }
        />
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PADDING,
    marginBottom: spacing.lg,
  },
  topActions: { flexDirection: 'row', gap: spacing.xs, marginRight: -spacing.sm },
  }),
);
