import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ALL_FILTER_SIZES, CONDITIONS, PRICE_RANGES, SORT_OPTIONS } from '@/constants/catalog';
import { colors, font, radius, spacing, themed } from '@/constants/theme';
import type { Condition, SortOption } from '@/types';

export interface ExploreFilters {
  sizes: string[];
  conditions: Condition[];
  minPrice: number | null;
  maxPrice: number | null;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ExploreFilters = { sizes: [], conditions: [], minPrice: null, maxPrice: null, sort: 'newest' };

export function countActiveFilters(f: ExploreFilters): number {
  return f.sizes.length + f.conditions.length + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.sort !== 'newest' ? 1 : 0);
}

interface FilterSheetProps {
  visible: boolean;
  initial: ExploreFilters;
  onClose: () => void;
  onApply: (filters: ExploreFilters) => void;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function FilterSheet({ visible, initial, onClose, onApply }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ExploreFilters>(initial);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setMinText(initial.minPrice != null ? String(initial.minPrice) : '');
    setMaxText(initial.maxPrice != null ? String(initial.maxPrice) : '');
  }, [visible, initial]);

  const setPrice = (min: number | null, max: number | null) => {
    setDraft((d) => ({ ...d, minPrice: min, maxPrice: max }));
    setMinText(min != null ? String(min) : '');
    setMaxText(max != null ? String(max) : '');
  };

  const parse = (text: string) => {
    const n = parseFloat(text.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const apply = () => {
    let min = parse(minText);
    let max = parse(maxText);
    if (min != null && max != null && min > max) [min, max] = [max, min];
    onApply({ ...draft, minPrice: min, maxPrice: max });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close filters">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Filters</Text>
          <Pressable
            onPress={() => {
              setDraft(DEFAULT_FILTERS);
              setMinText('');
              setMaxText('');
            }}
            hitSlop={10}
          >
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Sort by</Text>
          <View style={styles.wrap}>
            {SORT_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={draft.sort === o.value} onPress={() => setDraft((d) => ({ ...d, sort: o.value }))} />
            ))}
          </View>

          <Text style={styles.section}>Price</Text>
          <View style={styles.wrap}>
            {PRICE_RANGES.map((r) => {
              const selected = draft.minPrice === (r.min ?? null) && draft.maxPrice === (r.max ?? null);
              return (
                <Chip
                  key={r.label}
                  label={r.label}
                  selected={selected}
                  onPress={() => (selected ? setPrice(null, null) : setPrice(r.min ?? null, r.max ?? null))}
                />
              );
            })}
          </View>
          <View style={styles.priceRow}>
            <View style={styles.priceField}>
              <Text style={styles.currency}>€</Text>
              <TextInput
                value={minText}
                onChangeText={(t) => {
                  setMinText(t);
                  setDraft((d) => ({ ...d, minPrice: parse(t) }));
                }}
                placeholder="Min"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={styles.priceInput}
              />
            </View>
            <Text style={styles.dash}>–</Text>
            <View style={styles.priceField}>
              <Text style={styles.currency}>€</Text>
              <TextInput
                value={maxText}
                onChangeText={(t) => {
                  setMaxText(t);
                  setDraft((d) => ({ ...d, maxPrice: parse(t) }));
                }}
                placeholder="Max"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textSecondary}
                style={styles.priceInput}
              />
            </View>
          </View>

          <Text style={styles.section}>Condition</Text>
          <View style={styles.wrap}>
            {CONDITIONS.map((c) => (
              <Chip
                key={c.name}
                label={c.name}
                selected={draft.conditions.includes(c.name)}
                onPress={() => setDraft((d) => ({ ...d, conditions: toggle(d.conditions, c.name) }))}
              />
            ))}
          </View>

          <Text style={styles.section}>Size</Text>
          <View style={styles.wrap}>
            {ALL_FILTER_SIZES.map((s) => (
              <Chip key={s} label={s} selected={draft.sizes.includes(s)} onPress={() => setDraft((d) => ({ ...d, sizes: toggle(d.sizes, s) }))} />
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button title="Show results" onPress={apply} />
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  reset: { fontSize: font.size.md, color: colors.primary, fontWeight: font.weight.semibold },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  section: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  priceField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  currency: { color: colors.textSecondary, fontSize: font.size.md },
  priceInput: { flex: 1, fontSize: font.size.md, color: colors.text, height: '100%' },
  dash: { color: colors.textSecondary },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  }),
);
