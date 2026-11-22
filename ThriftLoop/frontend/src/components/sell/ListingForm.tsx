import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { CATEGORIES, CONDITIONS, sizesForCategory } from '@/constants/catalog';
import { colors, fs, GUTTER, spacing, themed, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { productsApi } from '@/services/api';
import type { Category, Condition, LocalImage, Product } from '@/types';
import { formatPrice } from '@/utils/format';
import { haptic } from '@/utils/haptics';

import { ListingPreview } from './ListingPreview';
import { PhotoPicker, photoUri, type ListingPhoto } from './PhotoPicker';

interface ListingFormProps {
  /** When given, the form edits this listing instead of creating a new one. */
  product?: Product;
  onSaved: (product: Product) => void;
  header?: ReactNode;
  /** Space below the sticky action bar (home indicator when shown as a sheet). */
  bottomInset?: number;
}

type Errors = Partial<Record<'photos' | 'title' | 'description' | 'price' | 'category' | 'size' | 'condition', string>>;

function normalizePrice(text: string): string {
  // Keep one decimal separator and at most two decimals: "12,5" → "12.5"
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

export function ListingForm({ product, onSaved, header, bottomInset = 0 }: ListingFormProps) {
  const { user, refreshUser } = useAuth();
  const editing = !!product;

  const [photos, setPhotos] = useState<ListingPhoto[]>(
    product?.images.map((img) => ({ kind: 'remote', id: img.id, url: img.url, angle: img.angle ?? null })) ?? [],
  );
  const [title, setTitle] = useState(product?.title ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [category, setCategory] = useState<Category | null>(product?.category ?? null);
  const [size, setSize] = useState<string | null>(product?.size ?? null);
  const [condition, setCondition] = useState<Condition | null>(product?.condition ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const priceValue = parseFloat(price);
  const sizes = sizesForCategory(category);

  const validate = (): boolean => {
    const next: Errors = {};
    if (!photos.length) next.photos = 'Add at least one photo.';
    if (title.trim().length < 3) next.title = 'Give your item a title (at least 3 characters).';
    if (description.trim().length < 10) next.description = 'Describe the item in at least 10 characters.';
    if (!Number.isFinite(priceValue) || priceValue <= 0) next.price = 'Enter a price above €0.';
    if (!category) next.category = 'Pick a category.';
    if (!size) next.size = 'Pick a size.';
    if (!condition) next.condition = 'Pick the condition.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const openPreview = () => {
    if (validate()) {
      setPreviewing(true);
    } else {
      void haptic.error();
      Alert.alert('Almost there', 'Please complete the highlighted fields.');
    }
  };

  const reset = () => {
    setPhotos([]);
    setTitle('');
    setDescription('');
    setPrice('');
    setCategory(null);
    setSize(null);
    setCondition(null);
    setErrors({});
  };

  const publish = async () => {
    if (!category || !size || !condition) return;
    setSaving(true);
    const input = {
      title: title.trim(),
      description: description.trim(),
      price: String(Math.round(priceValue * 100) / 100),
      category,
      size,
      condition,
    };
    const localPhotos = photos.filter((p) => p.kind === 'local');
    const remotePhotos = photos.filter((p) => p.kind === 'remote');
    const local: LocalImage[] = localPhotos.flatMap((p) => (p.kind === 'local' ? [p] : []));
    try {
      let saved: Product;
      if (product) {
        // Server keeps remote photos in the given order and appends new uploads after them.
        const keep = remotePhotos.flatMap((p) => (p.kind === 'remote' ? [p.id] : []));
        const angles = [...remotePhotos, ...localPhotos].map((p) => p.angle);
        saved = await productsApi.update(product.id, input, keep, local, angles);
      } else {
        saved = await productsApi.create(input, local, localPhotos.map((p) => p.angle));
      }
      void haptic.success();
      setPreviewing(false);
      if (!product) reset();
      void refreshUser();
      onSaved(saved);
    } catch (err) {
      void haptic.error();
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert(editing ? "Couldn't save changes" : "Couldn't publish", `${message}\n\nYour details are still here, so you can try again.`);
    } finally {
      setSaving(false);
    }
  };

  const clear = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 96 + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {header}

        <Section title="Photos">
          <PhotoPicker
            photos={photos}
            onChange={(p) => {
              setPhotos(p);
              clear('photos');
            }}
            error={errors.photos}
          />
        </Section>

        <Section title="About the item">
          <TextField
            label="Title"
            placeholder="e.g. Vintage Levi's denim jacket"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              clear('title');
            }}
            maxLength={80}
            error={errors.title}
            returnKeyType="next"
          />
          <TextField
            label="Description"
            meta={`${description.length}/2000`}
            placeholder="Fit, fabric, measurements and any flaws"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              clear('description');
            }}
            multiline
            maxLength={2000}
            error={errors.description}
          />
        </Section>

        <Section title="Category" error={errors.category}>
          <View style={styles.wrap}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.name}
                label={c.name}
                selected={category === c.name}
                onPress={() => {
                  setCategory(c.name);
                  if (size && !sizesForCategory(c.name).includes(size)) setSize(null);
                  clear('category');
                }}
              />
            ))}
          </View>
        </Section>

        <Section title="Size" error={errors.size} hint={category ? undefined : 'Pick a category to see matching sizes.'}>
          <View style={styles.wrap}>
            {sizes.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={size === s}
                onPress={() => {
                  setSize(s);
                  clear('size');
                }}
              />
            ))}
          </View>
        </Section>

        <Section title="Condition" error={errors.condition}>
          <View>
            {CONDITIONS.map((c, i) => {
              const selected = condition === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    void haptic.selection();
                    setCondition(c.name);
                    clear('condition');
                  }}
                  style={({ pressed }) => [styles.conditionRow, i > 0 && styles.rowDivider, pressed && { opacity: 0.6 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.flex}>
                    <Text style={[type.bodyStrong, selected && { color: colors.primary }]}>{c.name}</Text>
                    <Text style={type.footnote}>{c.hint}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={23}
                    color={selected ? colors.primary : colors.borderStrong}
                  />
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Price">
          <TextField
            prefix="€"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={(t) => {
              setPrice(normalizePrice(t));
              clear('price');
            }}
            onBlur={() => {
              const n = parseFloat(price);
              if (Number.isFinite(n) && price.includes('.')) setPrice(n.toFixed(2));
            }}
            error={errors.price}
            hint={
              Number.isFinite(priceValue) && priceValue > 0
                ? `You receive ${formatPrice(Math.round(priceValue * 90) / 100)} after ThriftLoop’s 10% fee. Buyers pay ${formatPrice(priceValue)} plus delivery.`
                : 'ThriftLoop keeps 10% of the price when your item sells. Buyers can message you to make an offer.'
            }
          />
        </Section>
      </ScrollView>

      {/* Sticky action bar, always reachable above the tab bar / home indicator. */}
      <View style={[styles.actionBar, { paddingBottom: spacing.md + bottomInset }]}>
        <Button title={editing ? 'Review changes' : 'Preview listing'} onPress={openPreview} />
      </View>

      {user && (
        <ListingPreview
          visible={previewing}
          onClose={() => setPreviewing(false)}
          onPublish={publish}
          publishing={saving}
          publishLabel={editing ? 'Save changes' : 'Publish listing'}
          user={user}
          photos={photos.map(photoUri)}
          title={title.trim()}
          description={description.trim()}
          price={priceValue}
          category={category ?? ''}
          size={size ?? ''}
          condition={condition ?? ''}
        />
      )}
    </View>
  );
}

function Section({ title, error, hint, children }: { title: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.headline}>{title}</Text>
      {hint && <Text style={[type.footnote, styles.sectionHint]}>{hint}</Text>}
      <View style={styles.sectionBody}>{children}</View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER },
  section: {
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  sectionHint: { marginTop: 2 },
  sectionBody: { marginTop: spacing.md, gap: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  error: { fontSize: fs(13), color: colors.danger, marginTop: spacing.sm },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  }),
);
