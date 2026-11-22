import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { formatPrice } from '@/utils/format';
import { haptic } from '@/utils/haptics';

interface Props {
  value: string | null;
  cities: string[];
  freeCity: string;
  fee: number;
  error?: string;
  onChange: (city: string) => void;
}

/** "City" field for delivery: opens a searchable list of Kosovo's municipalities with their delivery price. */
export function CityPicker({ value, cities, freeCity, fee, error, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cities.filter((c) => c.toLowerCase().includes(q)) : cities;
  }, [cities, query]);
  const priceFor = (city: string) => (city === freeCity ? 'Free delivery' : `${formatPrice(fee)} delivery`);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>City</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, !!error && styles.fieldError]}
        accessibilityRole="button"
        accessibilityLabel={value ? `City: ${value}, ${priceFor(value)}. Change city` : 'Choose your city'}
      >
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text style={[type.body, styles.flex, !value && { color: colors.textTertiary }]}>{value ?? 'Choose your city'}</Text>
        {value && <Text style={[styles.price, value === freeCity && styles.free]}>{priceFor(value)}</Text>}
        <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={type.footnote}>
          Delivery is free in {freeCity} and {formatPrice(fee)} anywhere else in Kosovo.
        </Text>
      )}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Delivery city</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={17} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Kosovo cities"
              placeholderTextColor={colors.textTertiary}
              style={styles.searchInput}
              autoCorrect={false}
              selectionColor={colors.primary}
            />
          </View>
          <FlatList
            data={shown}
            keyExtractor={(c) => c}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  void haptic.selection();
                  onChange(item);
                  setQuery('');
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
                accessibilityRole="button"
                accessibilityState={{ selected: item === value }}
              >
                <Text style={[type.body, styles.flex]}>{item}</Text>
                <Text style={[styles.price, item === freeCity && styles.free]}>{priceFor(item)}</Text>
                {item === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[type.footnote, styles.empty]}>We only deliver within Kosovo.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    flex: { flex: 1 },
    label: { fontSize: fs(14), fontWeight: '600', color: colors.text },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 50,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.fill,
      borderWidth: 1.5,
      borderColor: colors.fill,
    },
    fieldError: { borderColor: colors.danger },
    price: { fontSize: fs(13), fontWeight: '600', color: colors.textSecondary },
    free: { color: colors.primary },
    error: { color: colors.danger, fontSize: fs(13) },
    sheet: { flex: 1, backgroundColor: colors.background },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: GUTTER,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    sheetTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(22), color: colors.text },
    done: { fontSize: fs(16), fontWeight: '600', color: colors.primary },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: GUTTER,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.fill,
    },
    searchInput: { flex: 1, fontSize: fs(16), color: colors.text, padding: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: GUTTER,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    empty: { textAlign: 'center', marginTop: spacing.xl },
  }),
);
