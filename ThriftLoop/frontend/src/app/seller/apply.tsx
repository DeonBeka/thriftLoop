import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Checkbox, linkStyle } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import { colors, GUTTER, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { sellerApi } from '@/services/api';
import type { LocalImage } from '@/types';
import { haptic } from '@/utils/haptics';

type Field = 'full_name' | 'phone' | 'city' | 'selfie' | 'terms';

export default function ApplyToSell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [selfie, setSelfie] = useState<LocalImage | null>(null);
  const [idDoc, setIdDoc] = useState<LocalImage | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const ensureCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) return true;
    Alert.alert('Camera access needed', 'Verification needs a live photo. Allow camera access in Settings.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
    return false;
  };

  // Face verification: a *live* selfie from the front camera (no gallery uploads), reviewed by an admin.
  const takeSelfie = async () => {
    if (Platform.OS !== 'web' && !(await ensureCamera())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const a = result.assets[0];
    setSelfie({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName });
    setErrors((e) => ({ ...e, selfie: undefined }));
    void haptic.success();
  };

  const addIdDocument = async () => {
    const pick = async (camera: boolean) => {
      if (camera && !(await ensureCamera())) return;
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const a = result.assets[0];
      setIdDoc({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName });
    };
    Alert.alert('ID document (optional)', 'A photo of your ID card or passport speeds up review. It is only seen by admins.', [
      { text: 'Take photo', onPress: () => void pick(true) },
      { text: 'Choose from library', onPress: () => void pick(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = () => {
    const next: Partial<Record<Field, string>> = {};
    if (fullName.trim().split(/\s+/).length < 2) next.full_name = 'Enter your first and last name as on your ID.';
    if (phone.replace(/\D/g, '').length < 8) next.phone = 'Enter a valid phone number.';
    if (city.trim().length < 2) next.city = 'Enter your city.';
    if (!selfie) next.selfie = 'Take a selfie to verify your face.';
    if (!accepted) next.terms = 'Please accept the Seller Terms.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || !selfie) {
      void haptic.error();
      return;
    }
    setSubmitting(true);
    try {
      await sellerApi.apply({ full_name: fullName.trim(), phone: phone.trim(), city: city.trim(), note: note.trim(), selfie, idDocument: idDoc });
      await refreshUser();
      void haptic.success();
      Alert.alert('Application sent', 'Thanks! An admin will review your details and selfie. You’ll be able to sell once approved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      void haptic.error();
      Alert.alert("Couldn't send application", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: GUTTER, paddingBottom: 110 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={type.title}>Seller verification</Text>
        <Text style={[type.callout, styles.lead]}>Your details stay private. Only ThriftLoop admins see them.</Text>

        <Text style={[type.headline, styles.section]}>Face verification</Text>
        <Pressable onPress={takeSelfie} style={[styles.selfie, !!errors.selfie && styles.selfieError]} accessibilityRole="button">
          {selfie ? (
            <Image source={{ uri: selfie.uri }} style={styles.selfieImage} contentFit="cover" />
          ) : (
            <View style={styles.selfieEmpty}>
              <Ionicons name="scan-outline" size={34} color={colors.primary} />
              <Text style={styles.selfieLabel}>Take a selfie</Text>
            </View>
          )}
        </Pressable>
        <Text style={[type.footnote, styles.center, errors.selfie && { color: colors.danger }]}>
          {errors.selfie ?? (selfie ? 'Tap the photo to retake it.' : 'Face the camera in good light, no sunglasses or hats.')}
        </Text>

        <Text style={[type.headline, styles.section]}>Your details</Text>
        <View style={styles.fields}>
          <TextField label="Full name" placeholder="As on your ID" value={fullName} onChangeText={setFullName} error={errors.full_name} textContentType="name" autoComplete="name" />
          <TextField label="Phone" placeholder="+383 44 123 456" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone} textContentType="telephoneNumber" autoComplete="tel" />
          <TextField label="City" placeholder="e.g. Prishtina" value={city} onChangeText={setCity} error={errors.city} textContentType="addressCity" />
          <TextField label="Anything we should know? (optional)" placeholder="What you plan to sell" value={note} onChangeText={setNote} multiline maxLength={500} />
        </View>

        <Text style={[type.headline, styles.section]}>ID document (optional)</Text>
        <Pressable onPress={addIdDocument} style={styles.idRow} accessibilityRole="button">
          <Ionicons name={idDoc ? 'checkmark-circle' : 'card-outline'} size={22} color={colors.primary} />
          <Text style={[type.body, styles.flex]}>{idDoc ? 'ID photo added' : 'Add a photo of your ID'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>

        <View style={styles.section}>
          <Checkbox
            checked={accepted}
            onChange={(v) => {
              setAccepted(v);
              if (v) setErrors((e) => ({ ...e, terms: undefined }));
            }}
            error={!!errors.terms}
            label={
              <>
                I confirm these details are mine and agree to the{' '}
                <Text style={linkStyle} onPress={() => router.push('/legal/seller')}>
                  Seller Terms
                </Text>
                .
              </>
            }
          />
          {errors.terms && <Text style={styles.error}>{errors.terms}</Text>}
        </View>
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Submit for review" onPress={submit} loading={submitting} />
      </View>
    </View>
  );
}

const SELFIE = 168;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  lead: { marginTop: spacing.xs },
  section: { marginTop: spacing.xxl, marginBottom: spacing.md },
  center: { textAlign: 'center', marginTop: spacing.sm },
  selfie: {
    alignSelf: 'center',
    width: SELFIE,
    height: SELFIE,
    borderRadius: SELFIE / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    overflow: 'hidden',
    backgroundColor: colors.secondary,
  },
  selfieError: { borderColor: colors.danger },
  selfieImage: { width: '100%', height: '100%' },
  selfieEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  selfieLabel: { fontSize: 14, fontWeight: '600', color: colors.primary },
  fields: { gap: spacing.lg },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
});
