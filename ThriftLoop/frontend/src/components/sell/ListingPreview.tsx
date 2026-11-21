import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageGallery } from '@/components/product/ImageGallery';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import type { CurrentUser } from '@/types';
import { formatPrice } from '@/utils/format';

interface ListingPreviewProps {
  visible: boolean;
  onClose: () => void;
  onPublish: () => void;
  publishing: boolean;
  publishLabel: string;
  user: CurrentUser;
  photos: string[];
  title: string;
  description: string;
  price: number;
  category: string;
  size: string;
  condition: string;
}

/** Page-sheet preview that mirrors the product screen, so sellers see exactly what buyers will. */
export function ListingPreview(props: ListingPreviewProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={props.onClose} hitSlop={12} disabled={props.publishing}>
            <Text style={styles.headerAction}>Back to edit</Text>
          </Pressable>
          <Text style={type.headline}>Preview</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <ImageGallery urls={props.photos} />
          <View style={styles.content}>
            <Text style={styles.title}>{props.title}</Text>
            <Text style={type.priceLarge}>{formatPrice(props.price || 0)}</Text>
            <View style={styles.pills}>
              {[`Size ${props.size}`, props.condition, props.category].map((t) => (
                <View key={t} style={styles.pill}>
                  <Text style={styles.pillText}>{t}</Text>
                </View>
              ))}
            </View>
            <View style={styles.divider} />
            <Text style={type.overline}>Description</Text>
            <Text style={type.body}>{props.description}</Text>
            <View style={styles.divider} />
            <View style={styles.seller}>
              <Avatar uri={props.user.profile_image} name={props.user.username} size={40} />
              <View>
                <Text style={type.bodyStrong}>{props.user.username}</Text>
                <Text style={type.footnote}>That’s you</Text>
              </View>
            </View>
            <View style={styles.notice}>
              <Ionicons name="eye-outline" size={17} color={colors.primary} />
              <Text style={styles.noticeText}>This is how buyers will see your listing.</Text>
            </View>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button title={props.publishLabel} onPress={props.onPublish} loading={props.publishing} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: GUTTER,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerAction: { fontSize: 16, color: colors.primary },
  headerSpacer: { width: 90 },
  content: { paddingHorizontal: GUTTER, paddingTop: spacing.xl, gap: spacing.sm },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  pill: { backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.lg },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    marginTop: spacing.xl,
  },
  noticeText: { color: colors.primary, fontSize: 13, flex: 1 },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});
