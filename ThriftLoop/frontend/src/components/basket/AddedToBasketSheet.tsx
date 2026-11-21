import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/product/ProductImage';
import { Button } from '@/components/ui/Button';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import type { Product } from '@/types';
import { formatPrice } from '@/utils/format';

interface Props {
  visible: boolean;
  product: Product;
  count: number;
  onClose: () => void;
  onGoToBasket: () => void;
}

/** Bottom sheet after "Add to basket": go straight to the basket, or keep shopping. */
export function AddedToBasketSheet({ visible, product, count, onClose, onGoToBasket }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          <Text style={styles.title}>Added to your basket</Text>
        </View>
        <View style={styles.item}>
          <ProductImage uri={product.images[0]?.url} style={styles.thumb} />
          <View style={styles.flex}>
            <Text style={type.bodyStrong} numberOfLines={2}>
              {product.title}
            </Text>
            <Text style={type.footnote}>
              Size {product.size} · {product.condition}
            </Text>
          </View>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
        <Text style={[type.footnote, styles.count]}>
          {count} {count === 1 ? 'item' : 'items'} in your basket
        </Text>
        <View style={styles.actions}>
          <Button title="Go to basket" icon="bag-check-outline" onPress={onGoToBasket} />
          <Button title="Keep shopping" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(20,16,14,0.45)' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: GUTTER,
      paddingTop: spacing.sm,
      gap: spacing.md,
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.separator, marginBottom: spacing.xs },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(20), color: colors.text },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card },
    thumb: { width: 52, height: 65, borderRadius: radius.sm },
    flex: { flex: 1, gap: 2 },
    price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(18), color: colors.text },
    count: { textAlign: 'center' },
    actions: { gap: spacing.sm },
  }),
);
