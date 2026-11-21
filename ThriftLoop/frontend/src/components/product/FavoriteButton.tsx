import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { colors, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import type { Product } from '@/types';

interface FavoriteButtonProps {
  product: Pick<Product, 'id' | 'is_favorited' | 'seller'>;
  size?: 'sm' | 'lg';
}

export function FavoriteButton({ product, size = 'sm' }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(product);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (user && product.seller.id === user.id) return null; // can't save your own listing

  const dimension = size === 'lg' ? 44 : 32;
  const onPress = () => {
    scale.value = withSequence(withTiming(0.75, { duration: 90 }), withSpring(1, { damping: 6, stiffness: 260 }));
    void toggle(product);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from favorites' : 'Save to favorites'}
      style={[styles.button, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
    >
      <Animated.View style={animated}>
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={size === 'lg' ? 22 : 17}
          color={active ? colors.danger : colors.text}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});
