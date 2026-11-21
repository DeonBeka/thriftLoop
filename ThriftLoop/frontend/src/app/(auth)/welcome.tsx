import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { colors, font, radius, shadow, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { productsApi } from '@/services/api';
import { imageUrl } from '@/services/config';

// Tiles show the newest listings' photos (public endpoint); soft colour blocks if offline.
const TILES = ['#DDE8DF', '#EFEBE3', '#E1E7EF', '#ECE8E1'];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tile = (width - spacing.xxl * 2 - spacing.md) / 2;
  const { data } = useApi(() => productsApi.list({ limit: 4, sort: 'popular' }), []);
  const photos = data?.items.map((p) => imageUrl(p.images[0]?.url)) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Logo size={24} />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.collage}>
        {TILES.map((bg, i) => (
          <View
            key={bg}
            style={[
              styles.tile,
              { width: tile, height: tile * (i % 3 === 0 ? 1.3 : 1.05), backgroundColor: bg },
              i === 1 && { marginTop: spacing.xxl },
              i === 2 && { marginTop: -spacing.xxl + spacing.md },
            ]}
          >
            {photos[i] && (
              <Image source={{ uri: photos[i]! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            )}
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(250).duration(600)} style={styles.copy}>
        <Text style={styles.headline}>Pre-loved fashion,{'\n'}made easy.</Text>
        <Text style={styles.body}>Buy and sell second-hand clothing from people near you. Good for your wallet and the planet.</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(350).duration(600)} style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/register')} />
        <Button title="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl },
  collage: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignContent: 'center',
    marginVertical: spacing.xl,
    overflow: 'hidden',
  },
  tile: { borderRadius: radius.xl, overflow: 'hidden', ...shadow.card },
  copy: { gap: spacing.md, marginBottom: spacing.xxl },
  headline: { fontSize: 34, lineHeight: 40, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -1 },
  body: { fontSize: font.size.md, lineHeight: 22, color: colors.textSecondary },
  actions: { gap: spacing.sm },
});
