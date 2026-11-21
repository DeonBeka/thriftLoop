import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, themed } from '@/constants/theme';
import { imageUrl } from '@/services/config';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const src = imageUrl(uri);
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (src) {
    return <Image source={{ uri: src }} style={[styles.image, dimension]} contentFit="cover" transition={150} />;
  }
  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  image: { backgroundColor: colors.placeholder },
  fallback: { backgroundColor: colors.warmSoft, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.warm, fontFamily: 'Fraunces_600SemiBold' },
  }),
);
