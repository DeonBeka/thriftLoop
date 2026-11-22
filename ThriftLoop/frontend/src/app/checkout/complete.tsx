import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OrderSkeleton } from '@/components/skeletons';
import { colors, spacing, themed, type } from '@/constants/theme';

// On web, the card page opens in a popup that lands here; this hands the result back to the app window.
WebBrowser.maybeCompleteAuthSession();

/**
 * Where Stripe's card page sends the buyer back to (via the API, which verifies the payment first).
 * In the app the in-app browser catches this address and closes itself, so this screen only shows if
 * the link is opened on its own; then it forwards to the orders.
 */
export default function CheckoutComplete() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();

  useEffect(() => {
    const t = setTimeout(() => router.replace(status === 'paid' ? '/orders?placed=1' : '/basket'), 600);
    return () => clearTimeout(t);
  }, [router, status]);

  return (
    <View style={styles.container}>
      <Text style={[type.headline, styles.text]}>{status === 'paid' ? 'Payment received' : 'Back to ThriftLoop'}</Text>
      <OrderSkeleton />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl },
    text: { textAlign: 'center', marginBottom: spacing.lg },
  }),
);
