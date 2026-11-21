import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { GROUPS } from '@/constants/catalog';
import { GUTTER, spacing, themed } from '@/constants/theme';
import type { Group } from '@/types';

/** Super-category switcher: All · Tops · Bottoms · Shoes · Accessories. */
export function GroupTabs({ value, onChange }: { value: Group | null; onChange: (group: Group | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row}>
      <Chip label="Everything" selected={!value} onPress={() => onChange(null)} />
      {GROUPS.map((g) => (
        <Chip key={g.id} label={g.label} selected={value === g.id} onPress={() => onChange(value === g.id ? null : g.id)} />
      ))}
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    scroller: { marginHorizontal: -GUTTER },
    row: { paddingHorizontal: GUTTER, gap: spacing.sm },
  }),
);
