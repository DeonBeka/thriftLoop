import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Appearance, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ACCENTS, applyTheme, colors, fs, GUTTER, radius, spacing, TEXT_SCALE, themed, themeNav, type } from '@/constants/theme';
import { getPreferences, savePreferences, type AccentName, type Preferences, type TextSize, type ThemeMode } from '@/services/preferences';
import { haptic } from '@/utils/haptics';
import { speak, stopSpeaking } from '@/utils/speech';

const THEMES: { value: ThemeMode; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'system', label: 'Automatic', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

const SIZES: { value: TextSize; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra large' },
];

const RATES: { value: number; label: string }[] = [
  { value: 0.75, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
];

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Preferences>({ ...getPreferences() });
  const [applying, setApplying] = useState(false);
  const applied = getPreferences();

  // Look changes (theme, colour, size) are batched behind "Apply changes"; they switch live.
  const needsReload = prefs.theme !== applied.theme || prefs.accent !== applied.accent || prefs.textSize !== applied.textSize;

  /** Haptics and speech take effect immediately. */
  const update = (patch: Partial<Preferences>, instant = false) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void haptic.selection();
    if (instant) void savePreferences({ ...getPreferences(), ...pickInstant(next) });
  };

  const apply = async () => {
    setApplying(true);
    await savePreferences(prefs);
    void haptic.success();
    // Re-style the whole app in place (no restart) and come back to this screen.
    themeNav.returnTo = '/appearance';
    applyTheme(prefs);
  };

  const previewDark = prefs.theme === 'dark' || (prefs.theme === 'system' && Appearance.getColorScheme() === 'dark');
  const accent = ACCENTS[prefs.accent][previewDark ? 'dark' : 'light'];
  const previewScale = TEXT_SCALE[prefs.textSize];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: (needsReload ? 120 : 40) + insets.bottom }}>
        {/* Live preview of the pending choices */}
        <View style={[styles.preview, { backgroundColor: previewDark ? '#221E1A' : '#FFFCF7' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[styles.previewTitle, { color: previewDark ? '#F2ECE4' : '#2B2521', fontSize: 22 * previewScale }]}>Forest Green Hoodie</Text>
          <Text style={{ color: previewDark ? '#A99E92' : '#8B8178', fontSize: 14 * previewScale }}>Size L · Good · €38</Text>
          <View style={[styles.previewButton, { backgroundColor: accent.primary, height: Math.round(48 * (1 + (previewScale - 1) * 0.8)) }]}>
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 * previewScale }}>Buy now</Text>
          </View>
        </View>

        <Section title="Theme">
          <View style={styles.segment}>
            {THEMES.map((t) => {
              const active = prefs.theme === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => update({ theme: t.value })}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t.label} theme`}
                >
                  <Ionicons name={t.icon} size={20} color={active ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.footnote, styles.hint]}>Automatic follows your iPhone’s light or dark setting.</Text>
        </Section>

        <Section title="Button colour">
          <View style={styles.swatches}>
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => {
              const active = prefs.accent === name;
              const swatch = ACCENTS[name][previewDark ? 'dark' : 'light'].primary;
              return (
                <Pressable
                  key={name}
                  onPress={() => update({ accent: name })}
                  style={styles.swatchItem}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${ACCENTS[name].label} buttons`}
                >
                  <View style={[styles.swatchRing, active && { borderColor: swatch }]}>
                    <View style={[styles.swatch, { backgroundColor: swatch }]}>
                      {active && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </View>
                  </View>
                  <Text style={[styles.swatchLabel, active && { color: colors.text }]}>{ACCENTS[name].label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Text and button size">
          <View style={styles.sizes}>
            {SIZES.map((s) => {
              const active = prefs.textSize === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => update({ textSize: s.value })}
                  style={[styles.sizeItem, active && styles.sizeActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${s.label} text`}
                >
                  <Text style={[styles.sizeSample, { fontSize: 18 * TEXT_SCALE[s.value] }, active && { color: colors.primary }]}>Aa</Text>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.footnote, styles.hint]}>Makes text, buttons and fields bigger and easier to tap. Works together with iOS Larger Text.</Text>
        </Section>

        <Section title="Accessibility">
          <ToggleRow
            icon="pulse-outline"
            title="Haptic feedback"
            subtitle="Gentle vibrations when you tap, save or confirm."
            value={prefs.haptics}
            onChange={(v) => update({ haptics: v }, true)}
          />
          <ToggleRow
            icon="volume-high-outline"
            title="Voice guide"
            subtitle="Speaks as you move around: announces each screen and reads an item’s title, price, size and description when you open it. Stays quiet while VoiceOver is on."
            value={prefs.autoSpeak}
            onChange={(v) => update({ autoSpeak: v }, true)}
          />
          <Text style={[type.bodyStrong, styles.subTitle]}>Speaking speed</Text>
          <View style={styles.rates}>
            {RATES.map((r) => {
              const active = prefs.speechRate === r.value;
              return (
                <Pressable
                  key={r.label}
                  onPress={() => update({ speechRate: r.value }, true)}
                  style={[styles.rate, active && styles.rateActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.rateText, active && styles.rateTextActive]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            title="Test voice"
            icon="play-outline"
            variant="outline"
            size="md"
            onPress={() => {
              stopSpeaking();
              speak('Welcome to ThriftLoop. Tap the speaker on any item to hear its details.');
            }}
            style={{ marginTop: spacing.md }}
          />
          <View style={styles.tip}>
            <Ionicons name="accessibility-outline" size={20} color={colors.primary} />
            <Text style={[type.footnote, styles.flex]}>
              ThriftLoop works with VoiceOver, the iPhone screen reader. Turn it on in Settings → Accessibility → VoiceOver, or ask Siri “Turn on VoiceOver”.
            </Text>
          </View>
        </Section>
      </ScrollView>

      {needsReload && (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={[type.footnote, styles.barText]}>Your new look applies instantly across the app.</Text>
          <Button title="Apply changes" icon="color-palette-outline" onPress={apply} loading={applying} />
        </View>
      )}
    </View>
  );
}

function pickInstant(p: Preferences): Partial<Preferences> {
  return { haptics: p.haptics, autoSpeak: p.autoSpeak, speechRate: p.speechRate };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.headline} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: 'pulse-outline' | 'volume-high-outline';
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.footnote}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.fillPressed }}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, gap: 2 },
  preview: { borderRadius: radius.lg, padding: spacing.lg, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  previewTitle: { fontFamily: 'Fraunces_600SemiBold' },
  previewButton: { marginTop: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: spacing.xxl },
  sectionBody: { marginTop: spacing.md },
  hint: { marginTop: spacing.sm },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  segmentActive: { backgroundColor: colors.card, borderColor: colors.primary },
  segmentText: { fontSize: fs(13), fontWeight: '500', color: colors.textSecondary },
  segmentTextActive: { color: colors.text, fontWeight: '600' },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchItem: { alignItems: 'center', gap: 6 },
  swatchRing: { padding: 3, borderRadius: 28, borderWidth: 2, borderColor: 'transparent' },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchLabel: { fontSize: fs(12), color: colors.textSecondary },
  sizes: { flexDirection: 'row', gap: spacing.sm },
  sizeItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 86,
  },
  sizeActive: { backgroundColor: colors.card, borderColor: colors.primary },
  sizeSample: { fontFamily: 'Fraunces_600SemiBold', color: colors.text },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  subTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  rates: { flexDirection: 'row', gap: spacing.sm },
  rate: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.fill },
  rateActive: { backgroundColor: colors.primary },
  rateText: { fontSize: fs(14), fontWeight: '500', color: colors.text },
  rateTextActive: { color: colors.white },
  tip: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.secondary },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  barText: { textAlign: 'center' },
  }),
);
