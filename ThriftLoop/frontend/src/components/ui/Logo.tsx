import { StyleSheet, Text, View } from 'react-native';

import { colors, font } from '@/constants/theme';

/** Wordmark: two interlocking rings + "thriftloop". */
export function Logo({ size = 22, color = colors.primary }: { size?: number; color?: string }) {
  const ring = size * 0.78;
  return (
    <View style={styles.row}>
      <View style={{ width: ring * 1.55, height: ring }}>
        <View style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2, borderColor: color, borderWidth: size * 0.13 }]} />
        <View
          style={[
            styles.ring,
            {
              left: ring * 0.55,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderColor: colors.accent,
              borderWidth: size * 0.13,
            },
          ]}
        />
      </View>
      <Text style={[styles.word, { fontSize: size, color }]}>thriftloop</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { position: 'absolute', top: 0 },
  word: { fontWeight: font.weight.heavy, letterSpacing: -0.8 },
});
