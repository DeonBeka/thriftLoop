import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductGrid } from '@/components/product/ProductGrid';
import { ProfileHeader, type ListingTab } from '@/components/profile/ProfileHeader';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { colors, font, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { usersApi } from '@/services/api';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
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
  const listings = (data ?? []).filter((p) => p.status === tab);

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);

  const openMenu = () => {
    const options = ['Edit profile', 'Messages', 'Log out', 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) router.push('/profile/edit');
      if (i === 1) router.push('/messages');
      if (i === 2) confirmLogout();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3, destructiveButtonIndex: 2, title: user.email }, handle);
    } else {
      Alert.alert(user.email, undefined, [
        { text: 'Edit profile', onPress: () => handle(0) },
        { text: 'Messages', onPress: () => handle(1) },
        { text: 'Log out', style: 'destructive', onPress: () => handle(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.actions}>
          <IconButton icon="chatbubble-ellipses-outline" label="Messages" badge={unread} onPress={() => router.push('/messages')} />
          <IconButton icon="create-outline" label="Edit profile" onPress={() => router.push('/profile/edit')} />
          <IconButton icon="ellipsis-horizontal" label="More" onPress={openMenu} />
        </View>
      </View>

      {loading && !data ? (
        <LoadingView />
      ) : error && !data ? (
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
            />
          }
          empty={
            tab === 'active' ? (
              <EmptyState
                icon="pricetag-outline"
                title="No active listings"
                message="Turn the clothes you don't wear into cash."
                actionLabel="List an item"
                onAction={() => router.push('/sell')}
              />
            ) : (
              <EmptyState icon="bag-check-outline" title="Nothing sold yet" message="Items you mark as sold show up here." />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
