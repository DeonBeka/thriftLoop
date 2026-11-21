import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { colors, radius, spacing, themed } from '@/constants/theme';

import { IMAGE_RATIO } from './ProductCard';
import { ProductImage } from './ProductImage';

/**
 * Full-bleed, paged photo gallery. `bounces` is off so that on the first photo a rightward drag
 * from the screen edge isn't eaten by the scroll view and the native swipe-back gesture wins.
 */
export function ImageGallery({ urls, bottomInset = 0 }: { urls: string[]; bottomInset?: number }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = Math.round(width * IMAGE_RATIO);
  const pages = urls.length ? urls : [null];

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ width, height }}>
      <FlatList
        data={pages}
        keyExtractor={(item, i) => `${item}-${i}`}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index: i }) => (
          <View accessible accessibilityRole="image" accessibilityLabel={`Photo ${i + 1} of ${pages.length}`}>
            <ProductImage uri={item} style={{ width, height }} />
          </View>
        )}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />
      {pages.length > 1 && (
        <View style={[styles.indicator, { bottom: spacing.md + bottomInset }]} pointerEvents="none">
          <View style={styles.dots}>
            {pages.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  indicator: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dots: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: 'rgba(32,37,34,0.32)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.white },
  }),
);
