import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mannequin, type View3 } from '@/components/liveview/Mannequin';
import { ProductImage } from '@/components/product/ProductImage';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ErrorState, LoadingView } from '@/components/ui/States';
import { colors, fs, GUTTER, radius, spacing, themed, themeState, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { productsApi } from '@/services/api';
import { loadBody, saveBody } from '@/services/body';
import { getPreferences } from '@/services/preferences';
import { fitFor, garmentColors, garmentKind, LIMITS, sizeOptions, type Body, type FitKind } from '@/utils/fit';
import { haptic } from '@/utils/haptics';
import { speak, stopSpeaking } from '@/utils/speech';

const VIEWS: { id: View3; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
];

export default function LiveView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: product, error, loading, reload } = useApi(() => productsApi.get(Number(id)), [id]);

  const [body, setBody] = useState<Body | null>(() => loadBody());
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<View3>('front');
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const kind = product ? garmentKind(product.category, product.title) : 'top';
  const activeSize = size ?? product?.size ?? '';
  const fit = useMemo(() => (body && product ? fitFor(body, kind, activeSize) : null), [body, product, kind, activeSize]);

  // Voice guide reads the verdict.
  const spoken = useRef('');
  useEffect(() => {
    if (!fit || !getPreferences().autoSpeak) return;
    const text = `Size ${activeSize}. ${fit.headline}. ${fit.detail}`;
    if (text !== spoken.current) {
      spoken.current = text;
      speak(text);
    }
  }, [fit, activeSize]);

  // Swipe left/right on the mannequin to turn it.
  const order: View3[] = ['front', 'side', 'back'];
  const viewRef = useRef(view);
  viewRef.current = view;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) < 40) return;
          const i = order.indexOf(viewRef.current);
          const next = order[(i + (g.dx < 0 ? 1 : order.length - 1)) % order.length];
          void haptic.selection();
          setView(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (loading) return <LoadingView />;
  if (error || !product) return <ErrorState message={error ?? 'Listing not found.'} onRetry={reload} />;

  if (!body || editing) {
    return (
      <MeasurementsForm
        initial={body}
        onSave={async (b) => {
          await saveBody(b);
          void haptic.success();
          setBody(b);
          setEditing(false);
        }}
        onCancel={body ? () => setEditing(false) : undefined}
      />
    );
  }

  const [color, accent] = garmentColors(product.photo_colors, product.title);
  const sizes = sizeOptions(kind, product.size);
  const sellerPhoto =
    product.images.find((i) => i.angle === view) ?? (view === 'front' ? product.images.find((i) => !i.angle) ?? product.images[0] : null);
  const mannequinWidth = Math.min(width - GUTTER * 2 - 32, 300);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
      <View style={styles.titleRow}>
        <ProductImage uri={product.images[0]?.url} style={styles.thumb} />
        <View style={styles.flex}>
          <Text style={type.bodyStrong} numberOfLines={1}>
            {product.title}
          </Text>
          <Text style={type.footnote}>
            Listed as size {product.size} · {product.category}
          </Text>
        </View>
      </View>

      <View style={styles.stage}>
        <View style={styles.segment} accessibilityRole="tablist">
          {VIEWS.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => {
                void haptic.selection();
                setView(v.id);
              }}
              style={[styles.segmentItem, view === v.id && styles.segmentActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v.id }}
            >
              <Text style={[styles.segmentText, view === v.id && styles.segmentTextActive]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        <View {...pan.panHandlers} style={styles.mannequin} accessibilityLabel={`Mannequin wearing the item, ${view} view. ${fit?.headline ?? ''}`}>
          <Animated.View key={`${view}-${activeSize}`} entering={FadeIn.duration(260)}>
            <Mannequin
              body={body}
              view={view}
              width={mannequinWidth}
              skin={themeState.isDark ? '#5E625F' : '#E6DED2'}
              outline={colors.textTertiary}
              label={`${body.heightCm} cm`}
              garment={{
                kind,
                category: product.category,
                title: product.title,
                color,
                accent,
                ease: fit?.ease ?? 1,
                length: fit?.length ?? 1,
              }}
            />
          </Animated.View>
        </View>
        <Text style={styles.hint}>Swipe the mannequin to turn it</Text>
      </View>

      {fit && (
        <View style={[styles.fitCard, toneStyle(fit.kind)]}>
          <View style={styles.fitHead}>
            <Ionicons name={toneIcon(fit.kind)} size={20} color={toneColor(fit.kind)} />
            <Text style={[styles.fitTitle, { color: toneColor(fit.kind) }]}>
              {fit.kind === 'one-size' ? fit.headline : `Size ${activeSize}: ${fit.headline.toLowerCase()}`}
            </Text>
          </View>
          <Text style={type.body}>{fit.detail}</Text>
          {fit.recommended && fit.recommended !== activeSize && (
            <Pressable onPress={() => setSize(fit.recommended)} hitSlop={6} style={styles.recommend}>
              <Text style={styles.recommendText}>Your best size is probably {fit.recommended}. Try it on</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
          {activeSize !== product.size && (
            <Text style={type.footnote}>You are previewing size {activeSize}. This listing is size {product.size}.</Text>
          )}
        </View>
      )}

      {sizes.length > 0 && (
        <View style={styles.section}>
          <Text style={type.overline}>Try another size</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
            {sizes.map((s) => (
              <Chip key={s} label={s === product.size ? `${s} · listed` : s} selected={s === activeSize} onPress={() => setSize(s)} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={type.overline}>Seller’s photo · {VIEWS.find((v) => v.id === view)?.label}</Text>
        {sellerPhoto ? (
          <Animated.View key={sellerPhoto.id} entering={FadeIn.duration(200)}>
            <ProductImage uri={sellerPhoto.url} style={styles.sellerPhoto} />
          </Animated.View>
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="camera-outline" size={20} color={colors.textTertiary} />
            <Text style={type.footnote}>The seller hasn’t added a {view} photo. You can ask them in a message.</Text>
          </View>
        )}
      </View>

      <Pressable onPress={() => setEditing(true)} style={styles.measureRow} accessibilityRole="button">
        <Ionicons name="body-outline" size={20} color={colors.primary} />
        <Text style={[type.body, styles.flex]}>
          You: {body.heightCm} cm · {body.weightKg} kg
        </Text>
        <Text style={styles.edit}>Edit</Text>
      </Pressable>
      <Text style={styles.disclaimer}>
        Live view is a guide based on average body proportions and typical size charts. Brands vary, so check the
        measurements with the seller if you are between sizes.
      </Text>
    </ScrollView>
  );
}

function toneColor(kind: FitKind): string {
  if (kind === 'regular' || kind === 'one-size') return colors.primary;
  if (kind === 'snug' || kind === 'relaxed') return colors.warm;
  return colors.danger;
}
function toneIcon(kind: FitKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'regular' || kind === 'one-size') return 'checkmark-circle';
  if (kind === 'snug' || kind === 'relaxed') return 'information-circle';
  return 'alert-circle';
}
function toneStyle(kind: FitKind) {
  if (kind === 'regular' || kind === 'one-size') return styles.toneGood;
  if (kind === 'snug' || kind === 'relaxed') return styles.toneMid;
  return styles.toneBad;
}

function Stepper({ label, unit, value, onChange, min, max }: { label: string; unit: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  const n = Number(value) || 0;
  const step = (d: number) => {
    void haptic.selection();
    onChange(String(Math.min(max, Math.max(min, (n || (min + max) / 2) + d))));
  };
  return (
    <View style={styles.stepper}>
      <Text style={type.overline}>{label}</Text>
      <View style={styles.stepRow}>
        <Pressable onPress={() => step(-1)} style={styles.stepBtn} accessibilityLabel={`Decrease ${label}`} hitSlop={6}>
          <Ionicons name="remove" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.stepValue}>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            style={styles.stepInput}
            accessibilityLabel={`${label} in ${unit}`}
            selectionColor={colors.primary}
          />
          <Text style={styles.stepUnit}>{unit}</Text>
        </View>
        <Pressable onPress={() => step(1)} style={styles.stepBtn} accessibilityLabel={`Increase ${label}`} hitSlop={6}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function MeasurementsForm({ initial, onSave, onCancel }: { initial: Body | null; onSave: (b: Body) => void; onCancel?: () => void }) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(String(initial?.heightCm ?? 175));
  const [weight, setWeight] = useState(String(initial?.weightKg ?? 70));
  const h = Number(height);
  const w = Number(weight);
  const valid = h >= LIMITS.height[0] && h <= LIMITS.height[1] && w >= LIMITS.weight[0] && w <= LIMITS.weight[1];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="body-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.introTitle}>See it on your body</Text>
        <Text style={[type.body, styles.center]}>
          Enter your height and weight. We’ll build a mannequin with your proportions and show how each item fits. This
          stays on your phone.
        </Text>
      </View>
      <Stepper label="Height" unit="cm" value={height} onChange={setHeight} min={LIMITS.height[0]} max={LIMITS.height[1]} />
      <Stepper label="Weight" unit="kg" value={weight} onChange={setWeight} min={LIMITS.weight[0]} max={LIMITS.weight[1]} />
      {!valid && (
        <Text style={styles.invalid}>
          Height must be {LIMITS.height[0]}–{LIMITS.height[1]} cm and weight {LIMITS.weight[0]}–{LIMITS.weight[1]} kg.
        </Text>
      )}
      <Button title="Show me" icon="sparkles-outline" disabled={!valid} onPress={() => onSave({ heightCm: h, weightKg: w })} />
      {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: GUTTER, gap: spacing.lg },
    flex: { flex: 1 },
    center: { textAlign: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    thumb: { width: 48, height: 60, borderRadius: radius.sm },
    stage: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    },
    segment: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: 3 },
    segmentItem: { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.pill },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { fontSize: fs(14), fontWeight: '600', color: colors.textSecondary },
    segmentTextActive: { color: colors.white },
    mannequin: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
    hint: { fontSize: fs(12), color: colors.textTertiary },
    fitCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1 },
    toneGood: { backgroundColor: colors.secondary, borderColor: colors.secondary },
    toneMid: { backgroundColor: colors.card, borderColor: colors.warm },
    toneBad: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
    fitHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    fitTitle: { fontSize: fs(17), fontWeight: '700', flexShrink: 1 },
    recommend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    recommendText: { fontSize: fs(14), fontWeight: '600', color: colors.primary },
    section: { gap: spacing.sm },
    bleed: { marginHorizontal: -GUTTER },
    chips: { paddingHorizontal: GUTTER, gap: spacing.sm },
    sellerPhoto: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg },
    noPhoto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.fill,
    },
    measureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.card,
    },
    edit: { fontSize: fs(15), fontWeight: '600', color: colors.primary },
    disclaimer: { fontSize: fs(12), lineHeight: fs(17), color: colors.textTertiary },
    intro: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
    introIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(24), color: colors.text },
    stepper: { gap: spacing.sm },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    },
    stepInput: { fontSize: fs(28), fontWeight: '700', color: colors.text, minWidth: 60, textAlign: 'center', padding: 0 },
    stepUnit: { fontSize: fs(15), color: colors.textSecondary },
    invalid: { fontSize: fs(13), color: colors.danger },
  }),
);
