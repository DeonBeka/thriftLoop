import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/ProductCard';
import { colors, fs, GUTTER, radius, spacing, themed } from '@/constants/theme';
import { assistantApi } from '@/services/api';
import { getPreferences } from '@/services/preferences';
import type { AssistantFilters, AssistantReply } from '@/types';
import { haptic } from '@/utils/haptics';
import { speak, stopSpeaking } from '@/utils/speech';

type ChatItem =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; reply?: AssistantReply; error?: boolean };

const STARTERS = ['Blue tops under €10', 'Black jeans size W30', 'Cheapest shoes', 'Something warm for winter'];

const WELCOME: ChatItem = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi! I’m your ThriftLoop stylist. Tell me what you’re after, like a colour, item, size or budget, and I’ll find it in the shop.',
};

export default function AssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ChatItem[]>([WELCOME]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [provider, setProvider] = useState<string | null | undefined>(undefined); // undefined = loading
  const lastFilters = useRef<AssistantFilters | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  useEffect(() => {
    assistantApi.info().then((i) => setProvider(i.ai_enabled ? i.provider : null)).catch(() => setProvider(null));
    return () => stopSpeaking();
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    void haptic.light();
    setDraft('');
    setItems((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text: message }]);
    setThinking(true);
    try {
      const reply = await assistantApi.chat(message, lastFilters.current);
      lastFilters.current = reply.filters;
      setItems((prev) => [...prev, { id: `a${Date.now()}`, role: 'assistant', text: reply.reply, reply }]);
      if (getPreferences().autoSpeak) speak(reply.reply);
    } catch (err) {
      setItems((prev) => [
        ...prev,
        { id: `e${Date.now()}`, role: 'assistant', text: err instanceof Error ? err.message : 'Something went wrong.', error: true },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const lastAssistant = [...items].reverse().find((i) => i.role === 'assistant') as Extract<ChatItem, { role: 'assistant' }> | undefined;
  const chips = lastAssistant?.reply?.suggestions ?? (items.length === 1 ? STARTERS : []);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="interactive"
        ListHeaderComponent={
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>
                {provider === undefined ? 'AI stylist' : provider ? `Powered by ${provider}` : 'Smart search'}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (item.role === 'user' ? <UserBubble text={item.text} /> : <AssistantBubble item={item} router={router} />)}
        ListFooterComponent={thinking ? <TypingIndicator /> : undefined}
      />

      {chips.length > 0 && !thinking && (
        <Animated.View entering={FadeIn.duration(200)}>
          <FlatList
            horizontal
            data={chips}
            keyExtractor={(c) => c}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable onPress={() => void send(item)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            )}
          />
        </Animated.View>
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. blue tops under €10"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => void send(draft)}
          maxLength={500}
          accessibilityLabel="Message the AI stylist"
        />
        <Pressable
          onPress={() => void send(draft)}
          disabled={!draft.trim() || thinking}
          style={({ pressed }) => [styles.send, (!draft.trim() || thinking) && styles.sendDisabled, pressed && { opacity: 0.8 }]}
          accessibilityLabel="Send"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInUp.duration(200)} style={[styles.bubble, styles.userBubble]}>
      <Text style={styles.userText}>{text}</Text>
    </Animated.View>
  );
}

function AssistantBubble({ item, router }: { item: Extract<ChatItem, { role: 'assistant' }>; router: ReturnType<typeof useRouter> }) {
  const products = item.reply?.products ?? [];
  const f = item.reply?.filters;
  const single = f && f.groups.length + f.categories.length === 1;
  return (
    <Animated.View entering={FadeInUp.duration(250)} style={styles.assistantBlock}>
      <View style={styles.assistantRow}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color={colors.white} />
        </View>
        <View style={[styles.bubble, styles.assistantBubble, item.error && styles.errorBubble]}>
          <Text style={[styles.assistantText, item.error && { color: colors.danger }]}>{item.text}</Text>
        </View>
      </View>
      {products.length > 0 && (
        <FlatList
          horizontal
          data={products}
          keyExtractor={(p) => String(p.id)}
          showsHorizontalScrollIndicator={false}
          style={styles.productsScroller}
          contentContainerStyle={styles.products}
          renderItem={({ item: p }) => <ProductCard product={p} width={148} />}
        />
      )}
      {single && products.length > 0 && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/explore',
              params: f.categories[0] ? { category: f.categories[0] } : { group: f.groups[0] },
            })
          }
          style={styles.moreLink}
          hitSlop={8}
        >
          <Text style={styles.moreText}>Browse more in Explore</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.assistantRow} accessibilityLabel="The stylist is looking">
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={14} color={colors.white} />
      </View>
      <View style={[styles.bubble, styles.assistantBubble, styles.typing]}>
        <Text style={styles.typingText}>Looking through the racks…</Text>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list: { padding: GUTTER, paddingBottom: spacing.lg, gap: spacing.md },
    badgeRow: { alignItems: 'center', marginBottom: spacing.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.secondary,
    },
    badgeText: { fontSize: fs(12), fontWeight: '600', color: colors.primary },
    bubble: { paddingHorizontal: spacing.md + 2, paddingVertical: 10, borderRadius: 18, maxWidth: '85%' },
    userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
    userText: { fontSize: fs(15), lineHeight: fs(21), color: colors.white },
    assistantBlock: { gap: spacing.sm },
    assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assistantBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 6, flexShrink: 1 },
    errorBubble: { backgroundColor: colors.dangerSoft },
    assistantText: { fontSize: fs(15), lineHeight: fs(21), color: colors.text },
    typing: { opacity: 0.85 },
    typingText: { fontSize: fs(14), color: colors.textSecondary, fontStyle: 'italic' },
    productsScroller: { marginHorizontal: -GUTTER },
    products: { paddingHorizontal: GUTTER + 36, gap: spacing.md },
    moreLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 36 },
    moreText: { fontSize: fs(14), fontWeight: '600', color: colors.primary },
    chips: { paddingHorizontal: GUTTER, gap: spacing.sm, paddingBottom: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md + 2,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: { fontSize: fs(14), color: colors.text },
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
      minHeight: 42,
      borderRadius: 21,
      backgroundColor: colors.fill,
      paddingHorizontal: spacing.lg,
      fontSize: fs(16),
      color: colors.text,
    },
    send: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.4 },
  }),
);
