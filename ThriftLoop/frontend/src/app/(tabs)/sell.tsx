import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BecomeSeller } from '@/components/sell/BecomeSeller';
import { ListingForm } from '@/components/sell/ListingForm';
import { colors, spacing, themed, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function Sell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Viewers must be verified and approved by an admin before they can list.
  if (user && user.role === 'viewer') return <BecomeSeller />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <ListingForm
        header={
          <View style={styles.header}>
            <Text style={type.largeTitle}>Sell an item</Text>
            <Text style={type.callout}>Takes about a minute. Interested buyers will message you.</Text>
          </View>
        }
        onSaved={(product) => router.push(`/product/${product.id}`)}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { gap: spacing.xs, paddingBottom: spacing.xs },
  }),
);
