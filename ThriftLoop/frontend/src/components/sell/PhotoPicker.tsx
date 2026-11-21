import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductImage } from '@/components/product/ProductImage';
import { colors, font, radius, spacing } from '@/constants/theme';

export const MAX_PHOTOS = 8;

/** A photo is either already on the server (id) or freshly picked on the device. */
export type ListingPhoto =
  | { kind: 'remote'; id: number; url: string }
  | { kind: 'local'; uri: string; mimeType?: string | null; fileName?: string | null };

interface PhotoPickerProps {
  photos: ListingPhoto[];
  onChange: (photos: ListingPhoto[]) => void;
  error?: string | null;
}

export function photoUri(photo: ListingPhoto): string {
  return photo.kind === 'remote' ? photo.url : photo.uri;
}

export function PhotoPicker({ photos, onChange, error }: PhotoPickerProps) {
  const remaining = MAX_PHOTOS - photos.length;

  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked: ListingPhoto[] = result.assets.map((a) => ({
      kind: 'local',
      uri: a.uri,
      mimeType: a.mimeType ?? 'image/jpeg',
      fileName: a.fileName,
    }));
    onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos of your items.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const a = result.assets[0];
    onChange([...photos, { kind: 'local', uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName }]);
  };

  const add = () => {
    if (remaining <= 0) {
      Alert.alert('Photo limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    Alert.alert('Add photos', undefined, [
      { text: 'Choose from library', onPress: () => void fromLibrary() },
      { text: 'Take photo', onPress: () => void fromCamera() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));
  const makeCover = (index: number) => onChange([photos[index], ...photos.filter((_, i) => i !== index)]);

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable onPress={add} style={({ pressed }) => [styles.add, !!error && styles.addError, pressed && { opacity: 0.7 }]}>
          <Ionicons name="camera-outline" size={26} color={colors.primary} />
          <Text style={styles.addLabel}>Add photos</Text>
          <Text style={styles.addCount}>
            {photos.length}/{MAX_PHOTOS}
          </Text>
        </Pressable>
        {photos.map((photo, i) => (
          <Pressable key={`${photoUri(photo)}-${i}`} onLongPress={() => makeCover(i)} delayLongPress={250}>
            <ProductImage uri={photoUri(photo)} style={styles.thumb} />
            {i === 0 && (
              <View style={styles.cover}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            )}
            <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.remove} accessibilityLabel="Remove photo">
              <Ionicons name="close" size={14} color={colors.white} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.hint}>Good light and a plain background sell faster. Long-press a photo to make it the cover.</Text>
      )}
    </View>
  );
}

const SIZE = 104;

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: 2 },
  add: {
    width: SIZE,
    height: SIZE * 1.25,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addError: { borderColor: colors.danger },
  addLabel: { fontSize: font.size.sm, fontWeight: font.weight.semibold, color: colors.primary, marginTop: 4 },
  addCount: { fontSize: font.size.xs, color: colors.textSecondary },
  thumb: { width: SIZE, height: SIZE * 1.25, borderRadius: radius.md },
  cover: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverText: { color: colors.white, fontSize: 10, fontWeight: font.weight.bold },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(32,37,34,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: font.size.sm, color: colors.textSecondary, lineHeight: 18 },
  error: { fontSize: font.size.sm, color: colors.danger },
});
