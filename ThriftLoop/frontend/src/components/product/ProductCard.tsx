import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, spacing } from '@/constants/theme';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';

import { FavoriteButton } from './FavoriteButton';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  width: number;
}

export const ProductCard = memo(function ProductCard({ product, width }: ProductCardProps) {
  const router = useRouter();
  const sold = product.status === 'sold';
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${product.title}, ${formatPrice(product.price)}, size ${product.size}`}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View>
        <ProductImage uri={product.images[0]?.url} style={[styles.image, { height: width * 1.25 }]} />
        <View style={styles.favorite}>
          <FavoriteButton product={product} />
        </View>
        {sold && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.price}>{formatPrice(product.price)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {product.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {product.size} · {product.condition}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  image: { width: '100%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  favorite: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  soldBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  soldText: { color: colors.white, fontSize: 11, fontWeight: font.weight.bold, letterSpacing: 0.6 },
  body: { padding: spacing.md, gap: 2 },
  price: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, letterSpacing: -0.3 },
  title: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.medium },
  meta: { fontSize: font.size.sm, color: colors.textSecondary },
});
