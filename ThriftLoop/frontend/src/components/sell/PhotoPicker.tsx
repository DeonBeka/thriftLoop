import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ProductImage } from '@/components/product/ProductImage';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import { haptic } from '@/utils/haptics';

export const MAX_PHOTOS = 8;
const COLUMNS = 3;
const GAP = spacing.sm;

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

/** 3-column photo grid: add tile first, cover badge on the first photo, long-press to make a photo the cover. */
export function PhotoPicker({ photos, onChange, error }: PhotoPickerProps) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
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
    void haptic.light();
    onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph your items.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const a = result.assets[0];
    void haptic.light();
    onChange([...photos, { kind: 'local', uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName }]);
  };

  const add = () => {
    if (remaining <= 0) {
      Alert.alert('Photo limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void fromCamera();
          if (i === 1) void fromLibrary();
        },
      );
    } else if (Platform.OS === 'web') {
      void fromLibrary();
    } else {
      Alert.alert('Add photos', undefined, [
        { text: 'Take photo', onPress: () => void fromCamera() },
        { text: 'Choose from library', onPress: () => void fromLibrary() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const remove = (index: number) => {
    void haptic.selection();
    onChange(photos.filter((_, i) => i !== index));
  };
  const makeCover = (index: number) => {
    if (index === 0) return;
    void haptic.medium();
    onChange([photos[index], ...photos.filter((_, i) => i !== index)]);
  };

  const size = { width: tile, height: Math.round(tile * 1.25) };

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {photos.map((photo, i) => (
          <Animated.View
            key={photoUri(photo)}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(220)}
          >
            <Pressable onLongPress={() => makeCover(i)} delayLongPress={300} accessibilityHint="Long-press to make this the cover photo">
              <ProductImage uri={photoUri(photo)} style={[styles.thumb, size]} />
              {i === 0 && (
                <View style={styles.cover}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              )}
              <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.remove} accessibilityLabel="Remove photo">
                <Ionicons name="close" size={13} color={colors.white} />
              </Pressable>
            </Pressable>
          </Animated.View>
        ))}
        {remaining > 0 && (
          <Animated.View layout={LinearTransition.duration(220)}>
            <PressableScale onPress={add} scaleTo={0.96} style={[styles.add, size, !!error && styles.addError]} accessibilityRole="button" accessibilityLabel="Add photos">
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text style={styles.addLabel}>{photos.length ? 'Add more' : 'Add photos'}</Text>
            </PressableScale>
          </Animated.View>
        )}
      </View>
      <Text style={[type.footnote, error && styles.error]}>
        {error ?? `${photos.length}/${MAX_PHOTOS} · Natural light and a plain background sell faster. Long-press a photo to make it the cover.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  thumb: { borderRadius: radius.md },
  add: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addError: { borderColor: colors.danger },
  addLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cover: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(32,37,34,0.72)',
    borderRadius: radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(32,37,34,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger },
});
