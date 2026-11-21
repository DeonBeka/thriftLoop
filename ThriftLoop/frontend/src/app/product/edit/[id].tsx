import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingForm } from '@/components/sell/ListingForm';
import { ErrorState, LoadingView } from '@/components/ui/States';
import { colors, spacing } from '@/constants/theme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { productsApi } from '@/services/api';

export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(() => productsApi.get(Number(id)), [id]);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorState message={error ?? 'Listing not found.'} onRetry={reload} />;
  if (data.seller.id !== user?.id) return <ErrorState message="You can only edit your own listings." />;

  return (
    <View style={styles.container}>
      <ListingForm product={data} bottomInset={insets.bottom} onSaved={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.lg },
});
