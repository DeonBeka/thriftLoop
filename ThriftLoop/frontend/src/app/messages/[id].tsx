import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/product/ProductImage';
import { Avatar } from '@/components/ui/Avatar';
import { ChatSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/ui/States';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { messagesApi } from '@/services/api';
import type { Conversation, Message } from '@/types';
import { formatPrice, messageTime } from '@/utils/format';

const POLL_MS = 4000;

type ChatMessage = Message & { pending?: boolean; failed?: boolean };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 44; // iOS navigation bar height
  const { user } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastId = useRef<number | undefined>(undefined);

  const mergeIncoming = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    lastId.current = Math.max(lastId.current ?? 0, ...incoming.map((m) => m.id));
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !known.has(m.id))];
    });
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [convo, msgs] = await Promise.all([messagesApi.conversation(conversationId), messagesApi.messages(conversationId)]);
      setConversation(convo);
      setMessages(msgs);
      lastId.current = msgs.length ? msgs[msgs.length - 1].id : undefined;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Lightweight polling while the chat is open (WebSockets would be the next step).
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(async () => {
        try {
          mergeIncoming(await messagesApi.messages(conversationId, lastId.current));
        } catch {
          // ignore transient network errors while polling
        }
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [conversationId, mergeIncoming]),
  );

  const send = async (content: string, retryOf?: number) => {
    const text = content.trim();
    if (!text || !user) return;
    const tempId = retryOf ?? -Date.now();
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      pending: true,
    };
    setMessages((prev) => (retryOf ? prev.map((m) => (m.id === retryOf ? optimistic : m)) : [...prev, optimistic]));
    if (!retryOf) setDraft('');
    try {
      const saved = await messagesApi.send(conversationId, text);
      lastId.current = Math.max(lastId.current ?? 0, saved.id);
      setMessages((prev) => {
        const withoutDupes = prev.filter((m) => m.id !== saved.id);
        return withoutDupes.map((m) => (m.id === tempId ? saved : m));
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
    }
  };

  const other = conversation?.other_user;
  const product = conversation?.product;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () =>
            other ? (
              <Pressable onPress={() => router.push(`/user/${other.id}`)} style={styles.headerTitle}>
                <Avatar uri={other.profile_image} name={other.username} size={30} />
                <Text style={styles.headerName}>{other.username}</Text>
              </Pressable>
            ) : null,
        }}
      />
      {loading ? (
        <ChatSkeleton />
      ) : error && !conversation ? (
        <ErrorState message={error} onRetry={loadAll} />
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={headerHeight}
        >
          {product ? (
            <Pressable onPress={() => router.push(`/product/${product.id}`)} style={styles.productBar}>
              <ProductImage uri={product.image_url} style={styles.productThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle} numberOfLines={1}>
                  {product.title}
                </Text>
                <Text style={styles.productMeta}>
                  {formatPrice(product.price)}
                  {product.status === 'sold' ? ' · Sold' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.productBar}>
              <Text style={styles.productMeta}>This listing has been removed.</Text>
            </View>
          )}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyBody}>Ask about measurements, condition or how to arrange the sale.</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.sender_id === user?.id;
              const prev = messages[index - 1];
              const grouped = prev && prev.sender_id === item.sender_id;
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs, !grouped && { marginTop: spacing.md }]}>
                  <Pressable
                    disabled={!item.failed}
                    onPress={() => void send(item.content, item.id)}
                    style={[styles.bubble, mine ? styles.mine : styles.theirs, item.pending && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
                  </Pressable>
                  <Text style={styles.timestamp}>
                    {item.failed ? 'Not sent · tap to retry' : item.pending ? 'Sending…' : messageTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.primary}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={() => void send(draft)}
              disabled={!draft.trim()}
              style={({ pressed }) => [styles.send, !draft.trim() && styles.sendDisabled, pressed && { opacity: 0.8 }]}
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  productBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  productThumb: { width: 40, height: 48, borderRadius: radius.sm },
  productTitle: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text },
  productMeta: { fontSize: font.size.sm, color: colors.textSecondary },
  messages: { padding: spacing.lg, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  emptyBody: { fontSize: font.size.md, color: colors.textSecondary, textAlign: 'center' },
  bubbleRow: { maxWidth: '80%', marginTop: 3 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: spacing.md + 2, paddingVertical: 9, borderRadius: 18 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.fill, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: font.size.md, color: colors.text, lineHeight: 21 },
  bubbleTextMine: { color: colors.white },
  timestamp: { fontSize: 11, color: colors.textSecondary, marginTop: 3, marginHorizontal: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: colors.fill,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: font.size.md,
    color: colors.text,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.accent },
});
