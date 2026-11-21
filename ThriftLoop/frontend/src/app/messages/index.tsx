import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/product/ProductImage';
import { ConversationSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
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

  if (loading) return <ConversationSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title="No messages yet"
          message="Message a seller from any listing, and when buyers write to you, the chat shows up here."
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
  const preview = last ? `${last.sender_id === meId ? 'You: ' : ''}${last.content}` : 'No messages yet — say hi';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}>
      <View style={[styles.unreadDot, unread && styles.unreadDotOn]} />
      <Avatar uri={convo.other_user.profile_image} name={convo.other_user.username} size={50} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[type.bodyStrong, styles.name]} numberOfLines={1}>
            {convo.other_user.username}
          </Text>
          {last && <Text style={[type.caption, unread && styles.timeUnread]}>{messageTime(last.created_at)}</Text>}
        </View>
        <Text style={styles.product} numberOfLines={1}>
          {convo.product ? `${convo.product.title}${convo.product.status === 'sold' ? ' · Sold' : ''}` : 'Listing removed'}
        </Text>
        <Text style={[type.callout, unread && styles.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <ProductImage uri={convo.product?.image_url} style={styles.thumb} />
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    paddingRight: GUTTER,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: -spacing.xs },
  unreadDotOn: { backgroundColor: colors.primary },
  body: {
    flex: 1,
    gap: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1 },
  timeUnread: { color: colors.primary, fontWeight: '600' },
  product: { fontSize: fs(13), color: colors.primary, fontWeight: '500' },
  previewUnread: { color: colors.text, fontWeight: '500' },
  thumb: { width: 42, height: 52, borderRadius: radius.sm },
  }),
);
