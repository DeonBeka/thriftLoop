import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { colors, spacing } from '@/constants/theme';

import { ProductImage } from './ProductImage';

/** Full-width swipeable photo gallery with page dots. */
export function ImageGallery({ urls, aspect = 1.2 }: { urls: string[]; aspect?: number }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = width * aspect;
  const pages = urls.length ? urls : [null];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View>
      <FlatList
        data={pages}
        keyExtractor={(item, i) => `${item}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => <ProductImage uri={item} style={{ width, height }} />}
      />
      {pages.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: spacing.xxl + spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(32,37,34,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: colors.white, width: 16 },
});
