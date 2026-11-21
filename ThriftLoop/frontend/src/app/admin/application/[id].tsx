import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { adminApi } from '@/services/api';
import { getToken } from '@/services/storage';
import { haptic } from '@/utils/haptics';
import { joinedDate, timeAgo } from '@/utils/format';

export default function ReviewApplication() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const appId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: app, error, loading, reload, setData } = useApi(() => adminApi.application(appId), [appId]);
  const [token, setToken] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);

  useEffect(() => {
    void getToken().then(setToken);
  }, []);

  if (loading) return <FormSkeleton />;
  if (error || !app) return <ErrorState message={error ?? 'Application not found.'} onRetry={reload} />;

  // Verification photos are private: fetched with the admin's token, never cached on disk.
  const secured = (uri: string) => ({ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined });

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      Alert.alert('Add a reason', 'Tell the applicant what to fix (e.g. “Selfie is blurry”).');
      return;
    }
    setBusy(approve ? 'approve' : 'reject');
    try {
      const updated = approve ? await adminApi.approve(app.id, note.trim() || undefined) : await adminApi.reject(app.id, note.trim());
      setData(updated);
      void (approve ? haptic.success() : haptic.warning());
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const pending = app.status === 'pending';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: (pending ? 170 : 40) + insets.bottom }} automaticallyAdjustKeyboardInsets>
        <View style={styles.photos}>
          <View style={styles.photoBlock}>
            <Image source={token ? secured(adminApi.selfieUrl(app.id)) : undefined} style={styles.selfie} contentFit="cover" cachePolicy="none" />
            <Text style={type.caption}>Live selfie</Text>
          </View>
          {app.has_id_document && (
            <View style={styles.photoBlock}>
              <Image source={token ? secured(adminApi.idDocumentUrl(app.id)) : undefined} style={styles.idDoc} contentFit="contain" cachePolicy="none" />
              <Text style={type.caption}>ID document</Text>
            </View>
          )}
        </View>

        <Text style={[type.title, styles.name]}>{app.full_name}</Text>
        <Text style={type.footnote}>
          Applied {timeAgo(app.created_at)} · Status: {app.status}
        </Text>

        <View style={styles.list}>
          <Row label="Username" value={`@${app.user.username}`} />
          <Row label="Email" value={app.user_email ?? '—'} />
          <Row label="Phone" value={app.phone} />
          <Row label="City" value={app.city} />
          {app.note ? <Row label="Note" value={app.note} /> : null}
          {app.reviewed_at ? <Row label="Reviewed" value={joinedDate(app.reviewed_at)} /> : null}
          {app.admin_note ? <Row label="Admin note" value={app.admin_note} /> : null}
        </View>

        <View style={styles.checklist}>
          <Text style={type.overline}>Check before approving</Text>
          {['The selfie shows a real, clearly visible face', 'If an ID is attached, the face and name match', 'Name and phone look genuine'].map((t) => (
            <Text key={t} style={type.callout}>
              • {t}
            </Text>
          ))}
        </View>

        {pending && (
          <View style={{ marginTop: spacing.xl }}>
            <TextField label="Note to applicant" placeholder="Required when rejecting" value={note} onChangeText={setNote} multiline maxLength={500} />
          </View>
        )}
      </ScrollView>

      {pending && (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button title="Reject" variant="danger" style={styles.flex} loading={busy === 'reject'} disabled={!!busy} onPress={() => decide(false)} />
          <Button title="Approve seller" icon="checkmark" style={styles.flex2} loading={busy === 'approve'} disabled={!!busy} onPress={() => decide(true)} />
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[type.footnote, styles.rowLabel]}>{label}</Text>
      <Text style={[type.body, styles.flex]}>{value}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  flex2: { flex: 1.6 },
  photos: { flexDirection: 'row', gap: spacing.md },
  photoBlock: { flex: 1, gap: spacing.xs, alignItems: 'center' },
  selfie: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.placeholder },
  idDoc: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.placeholder },
  name: { marginTop: spacing.xl },
  list: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  row: { flexDirection: 'row', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, gap: spacing.md },
  rowLabel: { width: 90 },
  checklist: { marginTop: spacing.xl, gap: spacing.xs, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.secondary },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  }),
);
