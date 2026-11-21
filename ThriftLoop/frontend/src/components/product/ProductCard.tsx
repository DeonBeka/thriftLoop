import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { colors, fs, radius, spacing, themed, type } from '@/constants/theme';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';

import { FavoriteButton } from './FavoriteButton';
import { ProductImage } from './ProductImage';

export const IMAGE_RATIO = 1.25; // 4:5 portrait, the standard for clothing photos

interface ProductCardProps {
  product: Product;
  width: number;
}

/** Photo-first card: no box around it, just the image and three tight lines of text. */
export const ProductCard = memo(function ProductCard({ product, width }: ProductCardProps) {
  const router = useRouter();
  const sold = product.status !== 'active';
  return (
    <PressableScale
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${product.title}, ${formatPrice(product.price)}, size ${product.size}, ${product.condition}`}
      scaleTo={0.975}
      style={{ width }}
    >
      <View>
        <ProductImage uri={product.images[0]?.url} style={[styles.image, { height: width * IMAGE_RATIO }]} />
        {sold && (
          <View style={styles.soldScrim}>
            <Text style={styles.soldText}>{product.status === 'reserved' ? 'Reserved' : 'Sold'}</Text>
          </View>
        )}
        <View style={styles.favorite}>
          <FavoriteButton product={product} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.price, sold && styles.soldPrice]}>{formatPrice(product.price)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {product.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {product.size} · {product.condition}
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = themed(() =>
  StyleSheet.create({
  image: { width: '100%', borderRadius: radius.md },
  favorite: { position: 'absolute', right: spacing.sm, bottom: spacing.sm },
  soldScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: colors.soldScrim,
    alignItems: 'flex-start',
    padding: spacing.sm,
  },
  soldText: {
    backgroundColor: 'rgba(20,16,14,0.88)', // dark tag reads on photos in light and dark mode
    color: colors.white,
    fontSize: fs(11),
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  body: { paddingTop: spacing.sm + 2, gap: 1 },
  price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(17), lineHeight: fs(22), color: colors.text },
  soldPrice: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  title: { fontSize: fs(14), lineHeight: fs(19), color: colors.text },
  }),
);
