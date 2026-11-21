import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBox, SkeletonCircle, SkeletonGroup, SkeletonText } from '@/components/ui/Skeleton';
import { GRID_GAP, IMAGE_RATIO, useCardWidth } from '@/components/product/ProductGrid';
import { colors, control, GUTTER, radius, spacing, themed } from '@/constants/theme';

/** Mirrors ProductCard: 4:5 photo, then price, title and meta lines. */
export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width }}>
      <SkeletonBox height={width * IMAGE_RATIO} rounded={radius.md} />
      <View style={styles.cardText}>
        <SkeletonBox width="38%" height={14} rounded={radius.xs} />
        <SkeletonBox width="80%" height={12} rounded={radius.xs} />
        <SkeletonBox width="52%" height={10} rounded={radius.xs} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6, grouped = true }: { count?: number; grouped?: boolean }) {
  const width = useCardWidth();
  const grid = (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} width={width} />
      ))}
    </View>
  );
  return grouped ? <SkeletonGroup>{grid}</SkeletonGroup> : grid;
}

export function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <SkeletonGroup style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.row, styles.between, styles.gutter]}>
        <SkeletonBox width={128} height={24} rounded={radius.xs} />
        <SkeletonCircle size={36} />
      </View>
      <View style={[styles.gutter, { marginTop: spacing.xl, gap: spacing.sm }]}>
        <SkeletonBox width="45%" height={13} rounded={radius.xs} />
        <SkeletonBox width="78%" height={24} rounded={radius.xs} />
      </View>
      <View style={[styles.gutter, { marginTop: spacing.lg }]}>
        <SkeletonBox height={control.md} rounded={radius.md} />
      </View>
      <View style={[styles.row, styles.gutter, { gap: spacing.sm, marginTop: spacing.lg }]}>
        {[44, 76, 64, 70, 58].map((w, i) => (
          <SkeletonBox key={i} width={w} height={control.sm} rounded={radius.pill} />
        ))}
      </View>
      <View style={[styles.gutter, { marginTop: spacing.xxl }]}>
        <SkeletonBox width={140} height={18} rounded={radius.xs} style={{ marginBottom: spacing.md }} />
        <ProductGridSkeleton count={4} grouped={false} />
      </View>
    </SkeletonGroup>
  );
}

export function ProductDetailsSkeleton() {
  const { width } = useWindowDimensions();
  return (
    <SkeletonGroup style={styles.screen}>
      <SkeletonBox height={width * IMAGE_RATIO} rounded={0} />
      <View style={[styles.gutter, { paddingTop: spacing.xl, gap: spacing.md }]}>
        <SkeletonBox width="70%" height={22} rounded={radius.xs} />
        <SkeletonBox width="28%" height={26} rounded={radius.xs} />
        <View style={[styles.row, { gap: spacing.sm }]}>
          <SkeletonBox width={64} height={26} rounded={radius.pill} />
          <SkeletonBox width={88} height={26} rounded={radius.pill} />
          <SkeletonBox width={72} height={26} rounded={radius.pill} />
        </View>
        <View style={styles.divider} />
        <SkeletonText lines={4} size={15} />
        <View style={styles.divider} />
        <View style={[styles.row, { gap: spacing.md }]}>
          <SkeletonCircle size={44} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <SkeletonBox width="40%" height={14} rounded={radius.xs} />
            <SkeletonBox width="60%" height={11} rounded={radius.xs} />
          </View>
        </View>
      </View>
    </SkeletonGroup>
  );
}

export function ProfileSkeleton({ withTopBar = false }: { withTopBar?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <SkeletonGroup style={[styles.screen, withTopBar && { paddingTop: insets.top + spacing.sm }]}>
      {withTopBar && (
        <View style={[styles.row, styles.between, styles.gutter, { marginBottom: spacing.xl }]}>
          <SkeletonBox width={110} height={30} rounded={radius.xs} />
          <SkeletonCircle size={36} />
        </View>
      )}
      <View style={[styles.row, styles.gutter, { gap: spacing.lg }]}>
        <SkeletonCircle size={76} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SkeletonBox width="55%" height={20} rounded={radius.xs} />
          <SkeletonBox width="40%" height={12} rounded={radius.xs} />
        </View>
      </View>
      <View style={[styles.gutter, { marginTop: spacing.lg, gap: spacing.lg }]}>
        <SkeletonText lines={2} size={15} lastLineWidth="70%" />
        <SkeletonBox width="65%" height={14} rounded={radius.xs} />
        <SkeletonBox height={control.md} rounded={radius.md} />
        <ProductGridSkeleton count={4} grouped={false} />
      </View>
    </SkeletonGroup>
  );
}

export function ConversationSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <SkeletonGroup style={[styles.screen, { paddingTop: spacing.sm }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, styles.gutter, { gap: spacing.md, paddingVertical: spacing.md }]}>
          <SkeletonCircle size={52} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={[styles.row, styles.between]}>
              <SkeletonBox width="38%" height={14} rounded={radius.xs} />
              <SkeletonBox width={36} height={10} rounded={radius.xs} />
            </View>
            <SkeletonBox width="50%" height={11} rounded={radius.xs} />
            <SkeletonBox width={i % 2 ? '72%' : '86%'} height={11} rounded={radius.xs} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function ChatSkeleton() {
  const bubbles = [
    { mine: false, w: '62%' },
    { mine: true, w: '48%' },
    { mine: false, w: '70%' },
    { mine: true, w: '36%' },
    { mine: true, w: '58%' },
  ] as const;
  return (
    <SkeletonGroup style={[styles.screen, { padding: GUTTER, gap: spacing.md }]}>
      {bubbles.map((b, i) => (
        <SkeletonBox key={i} width={b.w} height={38} rounded={radius.xl} style={{ alignSelf: b.mine ? 'flex-end' : 'flex-start' }} />
      ))}
    </SkeletonGroup>
  );
}

/** Generic form placeholder (edit listing / edit profile). */
export function FormSkeleton() {
  return (
    <SkeletonGroup style={[styles.screen, { padding: GUTTER, gap: spacing.xl }]}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} width={96} height={120} rounded={radius.md} />
        ))}
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <SkeletonBox width={90} height={12} rounded={radius.xs} />
          <SkeletonBox height={i === 1 ? 110 : control.lg} rounded={radius.md} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  gutter: { paddingHorizontal: GUTTER },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: spacing.xl },
  cardText: { paddingTop: spacing.sm + 2, gap: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.sm },
  }),
);
