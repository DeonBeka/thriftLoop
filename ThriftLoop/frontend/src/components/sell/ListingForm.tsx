import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { CATEGORIES, CONDITIONS, sizesForCategory } from '@/constants/catalog';
import { colors, font, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { productsApi } from '@/services/api';
import type { Category, Condition, LocalImage, Product } from '@/types';

import { ListingPreview } from './ListingPreview';
import { PhotoPicker, photoUri, type ListingPhoto } from './PhotoPicker';

interface ListingFormProps {
  /** When given, the form edits this listing instead of creating a new one. */
  product?: Product;
  onSaved: (product: Product) => void;
  header?: ReactNode;
  bottomInset?: number;
}

type Errors = Partial<Record<'photos' | 'title' | 'description' | 'price' | 'category' | 'size' | 'condition', string>>;

export function ListingForm({ product, onSaved, header, bottomInset = 0 }: ListingFormProps) {
  const { user, refreshUser } = useAuth();
  const editing = !!product;

  const [photos, setPhotos] = useState<ListingPhoto[]>(
    product?.images.map((img) => ({ kind: 'remote', id: img.id, url: img.url })) ?? [],
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

  const priceValue = parseFloat(price.replace(',', '.'));
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
    if (validate()) setPreviewing(true);
    else Alert.alert('Almost there', 'Please fill in the highlighted fields.');
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
    const local: LocalImage[] = photos.flatMap((p) => (p.kind === 'local' ? [p] : []));
    try {
      let saved: Product;
      if (product) {
        // Server keeps remote photos in the given order and appends new uploads after them.
        const keep = photos.flatMap((p) => (p.kind === 'remote' ? [p.id] : []));
        saved = await productsApi.update(product.id, input, keep, local);
      } else {
        saved = await productsApi.create(input, local);
      }
      setPreviewing(false);
      if (!product) reset();
      void refreshUser();
      onSaved(saved);
    } catch (err) {
      Alert.alert(editing ? "Couldn't save changes" : "Couldn't publish", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const clear = (key: keyof Errors) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {header}
        <Section title="Photos" step={1}>
          <PhotoPicker
            photos={photos}
            onChange={(p) => {
              setPhotos(p);
              clear('photos');
            }}
            error={errors.photos}
          />
        </Section>

        <Section title="Details" step={2}>
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
            placeholder="Fit, material, measurements, any flaws…"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              clear('description');
            }}
            multiline
            maxLength={2000}
            error={errors.description}
            hint={`${description.length}/2000`}
          />
        </Section>

        <Section title="Category" step={3} error={errors.category}>
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

        <Section title="Size" step={4} error={errors.size}>
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

        <Section title="Condition" step={5} error={errors.condition}>
          <View style={styles.conditions}>
            {CONDITIONS.map((c) => {
              const selected = condition === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    setCondition(c.name);
                    clear('condition');
                  }}
                  style={[styles.condition, selected && styles.conditionSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conditionName}>{c.name}</Text>
                    <Text style={styles.conditionHint}>{c.hint}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? colors.primary : colors.borderStrong}
                  />
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Price" step={6}>
          <TextField
            prefix="€"
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={(t) => {
              setPrice(t.replace(/[^0-9.,]/g, ''));
              clear('price');
            }}
            error={errors.price}
          />
        </Section>

        <Button title={editing ? 'Preview changes' : 'Preview listing'} icon="eye-outline" onPress={openPreview} />
      </ScrollView>

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
    </>
  );
}

function Section({ title, step, error, children }: { title: string; step: number; error?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.step}>
          <Text style={styles.stepText}>{step}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xxl },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 12, fontWeight: font.weight.bold, color: colors.primary },
  sectionTitle: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  conditions: { gap: spacing.sm },
  condition: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  conditionSelected: { borderColor: colors.primary, backgroundColor: '#F3F8F4' },
  conditionName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  conditionHint: { fontSize: font.size.sm, color: colors.textSecondary, marginTop: 2 },
  error: { fontSize: font.size.sm, color: colors.danger },
});
