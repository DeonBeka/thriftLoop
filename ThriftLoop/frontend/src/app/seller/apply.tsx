import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Checkbox, linkStyles } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import { colors, fs, GUTTER, radius, spacing, themed, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { sellerApi } from '@/services/api';
import type { IdDocumentType, LocalImage } from '@/types';
import { haptic } from '@/utils/haptics';

type Field = 'full_name' | 'phone' | 'city' | 'selfie' | 'id' | 'terms';

const ID_TYPES: { id: IdDocumentType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'id_card', label: 'ID card', icon: 'card-outline' },
  { id: 'drivers_license', label: 'Driver’s licence', icon: 'car-outline' },
  { id: 'passport', label: 'Passport', icon: 'book-outline' },
];

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
  const [idType, setIdType] = useState<IdDocumentType | null>(null);
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
      setErrors((e) => ({ ...e, id: undefined }));
      void haptic.success();
    };
    if (Platform.OS === 'web') {
      void pick(false);
      return;
    }
    const name = ID_TYPES.find((t) => t.id === idType)?.label.toLowerCase() ?? 'ID';
    Alert.alert(`Photo of your ${name}`, 'Lay it flat in good light so the photo, name and date of birth are readable. Only admins see it.', [
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
    if (!idType) next.id = 'Choose which photo ID you are adding.';
    else if (!idDoc) next.id = 'Add a photo of your ID card, driver’s licence or passport.';
    if (!accepted) next.terms = 'Please accept the Seller Terms.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate() || !selfie || !idDoc || !idType) {
      void haptic.error();
      return;
    }
    setSubmitting(true);
    try {
      await sellerApi.apply({
        full_name: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        note: note.trim(),
        selfie,
        idDocument: idDoc,
        idDocumentType: idType,
      });
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

        <Text style={[type.headline, styles.section]}>Photo ID</Text>
        <Text style={[type.footnote, styles.idLead]}>
          Required. Admins check that your selfie matches an official photo ID.
        </Text>
        <View style={styles.idTypes} accessibilityRole="radiogroup">
          {ID_TYPES.map((t) => {
            const on = idType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  void haptic.selection();
                  setIdType(t.id);
                  setErrors((e) => ({ ...e, id: undefined }));
                }}
                style={[styles.idType, on && styles.idTypeOn, !!errors.id && !idType && styles.idTypeError]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                aria-checked={on}
                accessibilityLabel={t.label}
              >
                <Ionicons name={t.icon} size={22} color={on ? colors.white : colors.primary} />
                <Text style={[styles.idTypeText, on && styles.idTypeTextOn]} numberOfLines={2}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={addIdDocument}
          disabled={!idType}
          style={[styles.idPhoto, !!errors.id && !!idType && !idDoc && styles.idPhotoError, !idType && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={idDoc ? 'Retake ID photo' : 'Add a photo of your ID'}
        >
          {idDoc ? (
            <>
              <Image source={{ uri: idDoc.uri }} style={styles.idPreview} contentFit="cover" />
              <View style={styles.flex}>
                <Text style={type.bodyStrong}>{ID_TYPES.find((t) => t.id === idType)?.label} added</Text>
                <Text style={type.footnote}>Tap to retake</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            </>
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
              <Text style={[type.body, styles.flex]}>{idType ? 'Add a photo of it' : 'Choose a document type first'}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </>
          )}
        </Pressable>
        {errors.id && <Text style={styles.error}>{errors.id}</Text>}

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
                <Text style={linkStyles.link} onPress={() => router.push('/legal/seller')}>
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

const styles = themed(() =>
  StyleSheet.create({
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
  selfieLabel: { fontSize: fs(14), fontWeight: '600', color: colors.primary },
  fields: { gap: spacing.lg },
  idLead: { marginTop: -spacing.sm, marginBottom: spacing.md },
  idTypes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  idType: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  idTypeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  idTypeError: { borderColor: colors.danger },
  idTypeText: { fontSize: fs(13), fontWeight: '600', color: colors.primary, textAlign: 'center' },
  idTypeTextOn: { color: colors.white },
  idPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    borderWidth: 1.5,
    borderColor: colors.fill,
  },
  idPhotoError: { borderColor: colors.danger },
  idPreview: { width: 64, height: 42, borderRadius: radius.xs },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: fs(13), marginTop: spacing.sm },
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
  }),
);
