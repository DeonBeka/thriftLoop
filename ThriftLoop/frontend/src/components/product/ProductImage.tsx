import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';
import { imageUrl } from '@/services/config';

/** Product photo with a soft placeholder when the image is missing or fails to load. */
export function ProductImage({ uri, style }: { uri?: string | null; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(uri);
  return (
    <View style={[styles.container, style]}>
      {src && !failed ? (
        <Image
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          recyclingKey={src}
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
