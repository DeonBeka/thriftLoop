import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/product/ProductImage';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, LoadingView } from '@/components/ui/States';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { messagesApi } from '@/services/api';
import type { Conversation } from '@/types';
import { messageTime } from '@/utils/format';

export default function Inbox() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => messagesApi.conversations(), [], {
    refetchOnFocus: true,
  });

  if (loading) return <LoadingView />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title="No messages yet"
          message="When you message a seller (or a buyer messages you), the conversation shows up here."
          actionLabel="Browse items"
          onAction={() => router.push('/explore')}
        />
      }
      renderItem={({ item }) => <Row convo={item} meId={user?.id} onPress={() => router.push(`/messages/${item.id}`)} />}
    />
  );
}

function Row({ convo, meId, onPress }: { convo: Conversation; meId?: number; onPress: () => void }) {
  const last = convo.last_message;
  const unread = convo.unread_count > 0;
  const preview = last ? `${last.sender_id === meId ? 'You: ' : ''}${last.content}` : 'Say hi 👋';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.secondary }]}>
      <Avatar uri={convo.other_user.profile_image} name={convo.other_user.username} size={50} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {convo.other_user.username}
          </Text>
          {last && <Text style={[styles.time, unread && styles.timeUnread]}>{messageTime(last.created_at)}</Text>}
        </View>
        <Text style={styles.product} numberOfLines={1}>
          {convo.product ? `${convo.product.title}${convo.product.status === 'sold' ? ' · Sold' : ''}` : 'Listing removed'}
        </Text>
        <View style={styles.topLine}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{convo.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
      <ProductImage uri={convo.product?.image_url} style={styles.thumb} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingVertical: spacing.sm },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 82 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.semibold, flex: 1 },
  bold: { fontWeight: font.weight.bold },
  time: { fontSize: font.size.xs, color: colors.textSecondary },
  timeUnread: { color: colors.primary, fontWeight: font.weight.semibold },
  product: { fontSize: font.size.sm, color: colors.primary },
  preview: { fontSize: font.size.sm, color: colors.textSecondary, flex: 1 },
  previewUnread: { color: colors.text, fontWeight: font.weight.medium },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: font.weight.bold },
  thumb: { width: 46, height: 56, borderRadius: radius.sm },
});
