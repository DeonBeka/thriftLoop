import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ConversationSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { adminApi } from '@/services/api';
import type { AdminUser } from '@/types';
import { haptic } from '@/utils/haptics';

const ROLE_STYLE: Record<AdminUser['role'], { bg: string; fg: string; label: string }> = {
  admin: { bg: colors.primary, fg: colors.white, label: 'Admin' },
  seller: { bg: colors.secondary, fg: colors.primary, label: 'Seller' },
  viewer: { bg: colors.fill, fg: colors.textSecondary, label: 'Viewer' },
};

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi(() => adminApi.users(debounced), [debounced]);

  const changeRole = (user: AdminUser) => {
    if (user.role === 'admin') {
      Alert.alert('Admin account', 'Admins are set in the server settings (ADMIN_EMAILS) and can’t be changed here.');
      return;
    }
    const target = user.role === 'seller' ? 'viewer' : 'seller';
    const label = target === 'seller' ? 'Make seller' : 'Revoke seller access';
    const apply = async () => {
      try {
        const updated = await adminApi.setRole(user.id, target);
        setData((list) => list?.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        void haptic.success();
      } catch (err) {
        Alert.alert("Couldn't update", err instanceof Error ? err.message : 'Please try again.');
      }
    };
    const message = target === 'viewer' ? 'Their active listings will be taken down.' : 'They’ll be able to list items without a new application.';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: `@${user.username}`, message, options: [label, 'Cancel'], cancelButtonIndex: 1, destructiveButtonIndex: target === 'viewer' ? 0 : undefined },
        (i) => i === 0 && void apply(),
      );
    } else {
      Alert.alert(`@${user.username}`, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: label, style: target === 'viewer' ? 'destructive' : 'default', onPress: () => void apply() },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} placeholder="Search username or email" />
      </View>
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading ? [] : data ?? []}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
          ListEmptyComponent={loading ? <ConversationSkeleton rows={6} /> : <EmptyState icon="people-outline" title="No users found" />}
          renderItem={({ item }) => {
            const role = ROLE_STYLE[item.role];
            return (
              <Pressable onPress={() => changeRole(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}>
                <Avatar uri={item.profile_image} name={item.username} size={44} />
                <View style={styles.flex}>
                  <Text style={type.bodyStrong}>@{item.username}</Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {item.email}
                    {item.role !== 'viewer' ? ` · ${item.active_listings_count} listings` : item.seller_status === 'pending' ? ' · applied to sell' : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: role.bg }]}>
                  <Text style={[styles.badgeText, { color: role.fg }]}>{role.label}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { paddingHorizontal: GUTTER, paddingVertical: spacing.sm },
  content: { paddingHorizontal: GUTTER, paddingBottom: spacing.huge, flexGrow: 1 },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md },
  badge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
