import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageGallery } from '@/components/product/ImageGallery';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { colors, font, radius, spacing } from '@/constants/theme';
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

/** Shows the listing exactly as buyers will see it before publishing. */
export function ListingPreview(props: ListingPreviewProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={props.onClose} hitSlop={10}>
            <Text style={styles.headerAction}>Edit</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ImageGallery urls={props.photos} aspect={1.1} />
          <View style={styles.sheet}>
            <Text style={styles.price}>{formatPrice(props.price || 0)}</Text>
            <Text style={styles.title}>{props.title}</Text>
            <View style={styles.tags}>
              {[props.category, props.size, props.condition].map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.description}>{props.description}</Text>
            <View style={styles.seller}>
              <Avatar uri={props.user.profile_image} name={props.user.username} size={40} />
              <View>
                <Text style={styles.sellerName}>{props.user.username}</Text>
                <Text style={styles.sellerMeta}>That's you</Text>
              </View>
            </View>
            <View style={styles.notice}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  headerAction: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.primary },
  sheet: {
    marginTop: -spacing.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  price: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  title: { fontSize: font.size.xl, fontWeight: font.weight.semibold, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  tagText: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  description: { fontSize: font.size.md, lineHeight: 22, color: colors.text },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  sellerName: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  sellerMeta: { fontSize: font.size.sm, color: colors.textSecondary },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.secondary },
  noticeText: { color: colors.primary, fontSize: font.size.sm, flex: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.card },
});
