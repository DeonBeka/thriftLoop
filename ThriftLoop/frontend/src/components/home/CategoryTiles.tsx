import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { CATEGORIES } from '@/constants/catalog';
import { colors, fs, GUTTER, spacing } from '@/constants/theme';
import type { Category } from '@/types';
import { haptic } from '@/utils/haptics';

const SIZE = 64;

interface CategoryTilesProps {
  selected: Category | null;
  onSelect: (category: Category | null) => void;
}

/** Round photo tiles (like story bubbles). The active one gets a green ring. */
export function CategoryTiles({ selected, onSelect }: CategoryTilesProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
      <Tile label="All" active={!selected} onPress={() => onSelect(null)} />
      {CATEGORIES.map((c) => (
        <Tile
          key={c.name}
          label={c.name}
          photo={c.photo}
          active={selected === c.name}
          onPress={() => onSelect(selected === c.name ? null : c.name)}
        />
      ))}
    </ScrollView>
  );
}

function Tile({ label, photo, active, onPress }: { label: string; photo?: string; active: boolean; onPress: () => void }) {
  const ring = useAnimatedStyle(() => ({
    borderColor: withTiming(active ? colors.primary : 'rgba(0,0,0,0)', { duration: 180 }),
    transform: [{ scale: withTiming(active ? 1 : 0.96, { duration: 180 }) }],
  }));
  return (
    <Pressable
      onPress={() => {
        void haptic.selection();
        onPress();
      }}
      style={styles.tile}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.ring, ring]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.photo, styles.all]}>
            <Text style={styles.allText}>All</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroller: { marginHorizontal: -GUTTER },
  row: { paddingHorizontal: GUTTER, gap: spacing.md },
  tile: { alignItems: 'center', width: SIZE + 10, gap: 6 },
  ring: { padding: 2.5, borderRadius: (SIZE + 9) / 2, borderWidth: 2 },
  photo: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.placeholder },
  all: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  allText: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(17), color: colors.white },
  label: { fontSize: fs(12), fontWeight: '500', color: colors.textSecondary },
  labelActive: { color: colors.text, fontWeight: '600' },
});
