import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { colors, font, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usersApi } from '@/services/api';
import type { LocalImage } from '@/types';

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [image, setImage] = useState<LocalImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const a = result.assets[0];
    setImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName });
    setRemoveImage(false);
  };

  const changePhoto = () => {
    const hasPhoto = !!image || (!!user.profile_image && !removeImage);
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose from library', onPress: () => void pick() },
      ...(hasPhoto
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => (setImage(null), setRemoveImage(true)) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const save = async () => {
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(username.trim())) {
      setError('Username: 3–30 characters, letters, numbers, dots or underscores.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await usersApi.updateMe({ username: username.trim(), bio: bio.trim(), image, removeImage });
      setUser(updated);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = image?.uri ?? (removeImage ? null : user.profile_image);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Pressable onPress={changePhoto} style={styles.avatarWrap}>
        <Avatar uri={avatarUri} name={username || user.username} size={104} />
        <Text style={styles.changePhoto}>Change photo</Text>
      </Pressable>

      <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
      <TextField
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Tell buyers a bit about your style and how you ship."
        multiline
        maxLength={300}
        hint={`${bio.length}/300`}
      />
      <View style={styles.readonly}>
        <Text style={styles.readonlyLabel}>Email</Text>
        <Text style={styles.readonlyValue}>{user.email}</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save changes" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  avatarWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  changePhoto: { color: colors.primary, fontWeight: font.weight.semibold, fontSize: font.size.md },
  readonly: { gap: 4 },
  readonlyLabel: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.text },
  readonlyValue: { fontSize: font.size.md, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: font.size.sm },
});
