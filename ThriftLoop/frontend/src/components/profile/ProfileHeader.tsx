import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, font, radius, shadow, spacing } from '@/constants/theme';
import type { UserProfile } from '@/types';
import { joinedDate } from '@/utils/format';

export type ListingTab = 'active' | 'sold';

interface ProfileHeaderProps {
  profile: UserProfile;
  savedCount?: number;
  onPressSaved?: () => void;
  tab: ListingTab;
  onTabChange: (tab: ListingTab) => void;
}

export function ProfileHeader({ profile, savedCount, onPressSaved, tab, onTabChange }: ProfileHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Avatar uri={profile.profile_image} name={profile.username} size={84} />
        <Text style={styles.username}>{profile.username}</Text>
        <View style={styles.joinedRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.joined}>Joined {joinedDate(profile.created_at)}</Text>
        </View>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.stats}>
          <Stat value={profile.active_listings_count} label="Active" />
          <View style={styles.divider} />
          <Stat value={profile.sold_count} label="Sold" />
          {savedCount !== undefined && (
            <>
              <View style={styles.divider} />
              <Pressable onPress={onPressSaved} style={styles.statPress}>
                <Stat value={savedCount} label="Saved" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View style={styles.segment}>
        {(['active', 'sold'] as const).map((t) => (
          <Pressable key={t} onPress={() => onTabChange(t)} style={[styles.segmentItem, tab === t && styles.segmentActive]}>
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'active' ? `Listings (${profile.active_listings_count})` : `Sold (${profile.sold_count})`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  username: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text, marginTop: spacing.md },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  joined: { fontSize: font.size.sm, color: colors.textSecondary },
  bio: { fontSize: font.size.md, color: colors.text, textAlign: 'center', lineHeight: 21, marginTop: spacing.md },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    alignSelf: 'stretch',
  },
  stat: { flex: 1, alignItems: 'center' },
  statPress: { flex: 1 },
  statValue: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  statLabel: { fontSize: font.size.sm, color: colors.textSecondary, marginTop: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.borderStrong },
  segment: { flexDirection: 'row', backgroundColor: colors.secondary, borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: radius.sm + 2, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card, ...shadow.card },
  segmentText: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.textSecondary },
  segmentTextActive: { color: colors.text },
});
