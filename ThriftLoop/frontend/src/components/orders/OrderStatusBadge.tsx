import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { OrderStatus } from '@/types';

export const ORDER_STATUS: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: colors.warmSoft, fg: colors.warm },
  confirmed: { label: 'Confirmed', bg: colors.secondary, fg: colors.primary },
  delivered: { label: 'Delivered', bg: colors.primary, fg: colors.white },
  cancelled: { label: 'Cancelled', bg: colors.fill, fg: colors.textSecondary },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
