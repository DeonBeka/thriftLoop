import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { colors, shadow, themed } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import type { Product } from '@/types';
import { haptic } from '@/utils/haptics';

interface FavoriteButtonProps {
  product: Pick<Product, 'id' | 'is_favorited' | 'seller'>;
  /** `overlay`: small white disc on photos. `bar`: bordered square for the product action bar. */
  variant?: 'overlay' | 'bar';
}

export function FavoriteButton({ product, variant = 'overlay' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(product);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (user && product.seller.id === user.id) return null; // can't save your own listing

  const onPress = () => {
    // Quick pop: dip, then settle with a little spring.
    scale.value = withSequence(withTiming(0.72, { duration: 80 }), withSpring(1, { damping: 7, stiffness: 300 }));
    void (active ? haptic.selection() : haptic.light());
    void toggle(product);
  };

  const bar = variant === 'bar';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={bar ? 0 : 10}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? 'Remove from favorites' : 'Save to favorites'}
      style={({ pressed }) => [bar ? styles.bar : styles.overlay, pressed && bar && { backgroundColor: colors.fill }]}
    >
      <Animated.View style={animated}>
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={bar ? 22 : 16}
          color={active ? colors.danger : colors.text}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  overlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.overlayButton,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  bar: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  }),
);
