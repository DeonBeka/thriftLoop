import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingForm } from '@/components/sell/ListingForm';
import { colors, font, spacing } from '@/constants/theme';

export default function Sell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <ListingForm
        header={
          <View style={styles.header}>
            <Text style={styles.title}>Sell an item</Text>
            <Text style={styles.subtitle}>List it in under a minute. Buyers will message you to arrange the sale.</Text>
          </View>
        }
        onSaved={(product) => router.push(`/product/${product.id}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { gap: spacing.xs },
  title: { fontSize: font.size.display, fontWeight: font.weight.heavy, color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontSize: font.size.md, color: colors.textSecondary, lineHeight: 21 },
});
