import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { HERO_PHOTO } from '@/constants/catalog';
import { colors, fs, radius, spacing } from '@/constants/theme';

/** Warm editorial banner inviting people to list something. */
export function SellBanner({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={styles.card} accessibilityRole="button" accessibilityLabel="Start selling">
      <View style={styles.copy}>
        <Text style={styles.kicker}>Declutter, get paid</Text>
        <Text style={styles.title}>Give your clothes a second loop</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Start selling</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </View>
      </View>
      <Image source={{ uri: HERO_PHOTO }} style={styles.photo} contentFit="cover" transition={250} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 150,
  },
  copy: { flex: 1, padding: spacing.xl, justifyContent: 'space-between', gap: spacing.md },
  kicker: { fontSize: fs(12), fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(22), lineHeight: fs(27), color: colors.white, letterSpacing: -0.3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  ctaText: { fontSize: fs(14), fontWeight: '600', color: colors.primary },
  photo: { width: '38%', backgroundColor: colors.primaryPressed },
});
