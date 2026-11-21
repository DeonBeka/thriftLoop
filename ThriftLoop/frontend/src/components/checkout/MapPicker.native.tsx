import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { colors, fs, radius, shadow, spacing } from '@/constants/theme';
import { haptic } from '@/utils/haptics';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

// Default view: Prishtina, Kosovo. The user can pan anywhere or jump to their location.
const DEFAULT_REGION: Region = { latitude: 42.6629, longitude: 21.1655, latitudeDelta: 0.04, longitudeDelta: 0.04 };

function formatAddress(a: Location.LocationGeocodedAddress | undefined): string {
  if (!a) return '';
  const street = [a.street, a.streetNumber].filter(Boolean).join(' ');
  return [a.name && a.name !== street ? a.name : null, street || null, a.city, a.postalCode, a.country].filter(Boolean).join(', ');
}

/**
 * Drag the map under a fixed centre pin to choose the delivery spot. When the map stops moving
 * we reverse-geocode the centre into a readable address (editable afterwards as text).
 */
export function MapPicker({ value, onChange }: { value: PickedLocation | null; onChange: (loc: PickedLocation) => void }) {
  const mapRef = useRef<MapView>(null);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const lastLookup = useRef(0);
  const settled = useRef(false);

  const resolve = async (latitude: number, longitude: number) => {
    const id = ++lastLookup.current;
    setResolving(true);
    try {
      const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (id !== lastLookup.current) return;
      onChange({ latitude, longitude, address: formatAddress(first) });
    } catch {
      if (id === lastLookup.current) onChange({ latitude, longitude, address: value?.address ?? '' });
    } finally {
      if (id === lastLookup.current) setResolving(false);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        Alert.alert('Location is off', 'Allow location access in Settings, or move the map / type your address instead.', [
          { text: 'OK', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const region = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      mapRef.current?.animateToRegion(region, 500);
      void haptic.light();
      void resolve(region.latitude, region.longitude);
    } catch {
      Alert.alert("Couldn't find you", 'Move the map to your address or type it below.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={
          value ? { latitude: value.latitude, longitude: value.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 } : DEFAULT_REGION
        }
        onRegionChangeComplete={(r) => {
          // Skip the map's first settle on mount; react to drags and "use my location" afterwards.
          if (!settled.current) {
            settled.current = true;
            return;
          }
          void resolve(r.latitude, r.longitude);
        }}
        showsUserLocation
        showsPointsOfInterests={false}
        rotateEnabled={false}
        pitchEnabled={false}
      />
      {/* Fixed centre pin: the map moves under it. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <Ionicons name="location" size={38} color={colors.primary} />
      </View>
      <Pressable onPress={useMyLocation} style={styles.locate} accessibilityLabel="Use my location" hitSlop={6}>
        {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={18} color={colors.primary} />}
      </Pressable>
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText} numberOfLines={1}>
          {resolving ? 'Finding address…' : value?.address || 'Drag the map to place the pin'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 240, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.placeholder },
  pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 36 },
  locate: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  hint: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.mapHint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hintText: { fontSize: fs(13), color: colors.text },
});
