import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, type } from '@/constants/theme';
import type { UserProfile } from '@/types';
import { joinedDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export type ListingTab = 'active' | 'sold';

interface ProfileHeaderProps {
  profile: UserProfile;
  /** Private count, only passed on your own profile. */
  savedCount?: number;
  onPressSaved?: () => void;
  tab: ListingTab;
  onTabChange: (tab: ListingTab) => void;
  /** Buttons under the bio (e.g. Edit profile). */
  actions?: ReactNode;
}

/** Typography-led header: no card, hierarchy from size and weight. */
export function ProfileHeader({ profile, savedCount, onPressSaved, tab, onTabChange, actions }: ProfileHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.identity}>
        <Avatar uri={profile.profile_image} name={profile.username} size={76} />
        <View style={styles.flex}>
          <Text style={type.title} numberOfLines={1}>
            {profile.username}
          </Text>
          <Text style={type.footnote}>Joined {joinedDate(profile.created_at)}</Text>
          {profile.role !== 'viewer' && (
            <View style={styles.verified}>
              <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
              <Text style={styles.verifiedText}>{profile.role === 'admin' ? 'ThriftLoop admin' : 'Verified seller'}</Text>
            </View>
          )}
        </View>
      </View>

      {profile.bio ? <Text style={[type.body, styles.bio]}>{profile.bio}</Text> : null}

      <View style={styles.stats}>
        <Stat value={profile.active_listings_count} label={profile.active_listings_count === 1 ? 'listing' : 'listings'} />
        <Text style={styles.dot}>·</Text>
        <Stat value={profile.sold_count} label="sold" />
        {savedCount !== undefined && (
          <>
            <Text style={styles.dot}>·</Text>
            <Pressable onPress={onPressSaved} hitSlop={8}>
              <Stat value={savedCount} label="saved" />
            </Pressable>
          </>
        )}
      </View>

      {actions && <View style={styles.actions}>{actions}</View>}

      <View style={styles.tabs}>
        {(['active', 'sold'] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                if (!active) void haptic.selection();
                onTabChange(t);
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t === 'active' ? 'Listings' : 'Sold'}</Text>
              <View style={[styles.tabLine, active && styles.tabLineActive]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Text style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text> {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  flex: { flex: 1, gap: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bio: { marginTop: spacing.lg },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  verifiedText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  stat: { fontSize: 15, color: colors.textSecondary },
  statValue: { fontWeight: '700', color: colors.text },
  dot: { color: colors.textTertiary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  tabs: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, paddingBottom: spacing.md },
  tabTextActive: { color: colors.text },
  tabLine: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent', marginHorizontal: spacing.xxxl },
  tabLineActive: { backgroundColor: colors.primary },
});
