import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ProductImage } from '@/components/product/ProductImage';
import { GRID_PADDING } from '@/components/product/ProductGrid';
import { colors, fs, radius, spacing, themed } from '@/constants/theme';
import type { FeaturedListing } from '@/types';
import { formatPrice } from '@/utils/format';

const AUTO_ADVANCE_MS = 4200;
const RESUME_AFTER_TOUCH_MS = 7000;

/** Home "Featured" slideshow of boosted listings: auto-advances, swipeable, every slide marked Sponsored. */
export function FeaturedCarousel({ items }: { items: FeaturedListing[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const slideW = width - GRID_PADDING * 2;
  const slideH = Math.round(Math.min(230, slideW * 0.62));
  const listRef = useRef<FlatList<FeaturedListing>>(null);
  const [index, setIndex] = useState(0);
  const pausedUntil = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Auto-advance (paused briefly after the user swipes, and off when Reduce Motion is on).
  useEffect(() => {
    if (items.length < 2 || reduceMotion) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIndex((i) => {
        const next = (i + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * slideW, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [items.length, slideW, reduceMotion]);

  if (!items.length) return null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / slideW);
    if (i !== index) setIndex(Math.max(0, Math.min(items.length - 1, i)));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.heading}>Featured</Text>
        <Text style={styles.sponsoredNote}>Sponsored by sellers</Text>
      </View>
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        snapToInterval={slideW}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(f) => String(f.promotion_id)}
        getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
        onScrollBeginDrag={() => {
          pausedUntil.current = Date.now() + RESUME_AFTER_TOUCH_MS;
        }}
        onMomentumScrollEnd={onScrollEnd}
        style={{ width: slideW, borderRadius: radius.lg }}
        renderItem={({ item }) => {
          const p = item.product;
          return (
            <Pressable
              onPress={() => router.push(`/product/${p.id}`)}
              style={({ pressed }) => [{ width: slideW, height: slideH }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={`Sponsored: ${p.title}, ${formatPrice(p.price)}, size ${p.size}, from ${p.seller.username}`}
            >
              <ProductImage uri={p.images[0]?.url} style={[styles.image, { width: slideW, height: slideH }]} />
              <LinearGradient
                colors={['rgba(20,16,14,0)', 'rgba(20,16,14,0.15)', 'rgba(20,16,14,0.78)']}
                locations={[0.3, 0.55, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.badge}>
                <Ionicons name="flash" size={11} color={colors.white} />
                <Text style={styles.badgeText}>Sponsored</Text>
              </View>
              <View style={styles.caption}>
                <View style={styles.flex}>
                  <Text style={styles.title} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    Size {p.size} · {p.condition} · @{p.seller.username}
                  </Text>
                </View>
                <View style={styles.pricePill}>
                  <Text style={styles.price}>{formatPrice(p.price)}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      {items.length > 1 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items.map((f, i) => (
            <View key={f.promotion_id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    heading: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(20), color: colors.text },
    sponsoredNote: { fontSize: fs(12), color: colors.textTertiary },
    image: { borderRadius: radius.lg },
    badge: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(20,16,14,0.6)',
    },
    badgeText: { color: colors.white, fontSize: fs(11), fontWeight: '700', letterSpacing: 0.3 },
    caption: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.md,
      bottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.md,
    },
    flex: { flex: 1 },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(22), color: '#FFFFFF' },
    meta: { fontSize: fs(13), color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    pricePill: { backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
    price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(17), color: '#1F1A17' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.separator },
    dotOn: { width: 18, backgroundColor: colors.primary },
  }),
);
