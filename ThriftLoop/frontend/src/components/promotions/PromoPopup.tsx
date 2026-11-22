import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { ProductImage } from '@/components/product/ProductImage';
import { Button } from '@/components/ui/Button';
import { colors, fs, radius, spacing, themed, type } from '@/constants/theme';

interface Props {
  visible: boolean;
  eyebrow: string;
  title: string;
  body: string;
  image?: string | null;
  price?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onClose: () => void;
}

/** Centered promo pop-up (daily spotlight, "boost your listing"). Tap outside or "Not now" to close. */
export function PromoPopup({ visible, eyebrow, title, body, image, price, primaryLabel, secondaryLabel = 'Not now', onPrimary, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap outside to close: a sibling behind the card, so no buttons are nested inside it. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        {visible && (
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.card} accessibilityViewIsModal>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
            {image !== undefined && (
              <View>
                <ProductImage uri={image} style={styles.image} />
                {price && (
                  <Animated.View entering={FadeIn.delay(250)} style={styles.pricePill}>
                    <Text style={styles.price}>{price}</Text>
                  </Animated.View>
                )}
              </View>
            )}
            <View style={styles.content}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={[type.callout, styles.body]}>{body}</Text>
              <Button title={primaryLabel} onPress={onPrimary} />
              <Pressable onPress={onClose} hitSlop={6} style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryText}>{secondaryLabel}</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// ---- once-a-day cap for the spotlight pop-up (stored on the device) ----
const KEY = 'thriftloop.spotlight.lastShown';

export function spotlightShownToday(): boolean {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return raw === new Date().toDateString();
  } catch {
    return false;
  }
}

export function markSpotlightShown(): void {
  const today = new Date().toDateString();
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, today);
    else void SecureStore.setItemAsync(KEY, today);
  } catch {
    // ignore
  }
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(20,16,14,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    card: { width: '100%', maxWidth: 380, borderRadius: radius.xl, backgroundColor: colors.background, overflow: 'hidden' },
    close: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { width: '100%', height: 240 },
    pricePill: {
      position: 'absolute',
      left: spacing.lg,
      bottom: -18,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 8,
    },
    price: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(18), color: colors.white },
    content: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.sm },
    eyebrow: { fontSize: fs(12), fontWeight: '700', letterSpacing: 0.8, color: colors.warm, textTransform: 'uppercase' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: fs(24), lineHeight: fs(30), color: colors.text },
    body: { marginBottom: spacing.md },
    secondary: { alignItems: 'center', paddingVertical: spacing.sm },
    secondaryText: { fontSize: fs(15), fontWeight: '600', color: colors.textSecondary },
  }),
);
