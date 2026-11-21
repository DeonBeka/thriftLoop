import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, themed, type } from '@/constants/theme';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

/** Web fallback: maps aren't available in the browser preview, so the address is typed instead. */
export function MapPicker(_props: { value: PickedLocation | null; onChange: (loc: PickedLocation) => void }) {
  return (
    <View style={styles.box}>
      <Text style={type.footnote}>The map picker works in the iPhone app. Type your address below instead.</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  box: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.fill },
  }),
);
