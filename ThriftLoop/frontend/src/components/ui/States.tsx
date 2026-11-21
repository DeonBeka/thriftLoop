import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, fs, spacing, themed, type } from '@/constants/theme';

import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Only for tiny inline waits (e.g. loading more). Screens use skeletons instead. */
export function LoadingView() {
  return (
    <View style={styles.inline}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

interface StateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: 'neutral' | 'error';
}

function StateView({ icon, title, message, actionLabel, onAction, secondaryLabel, onSecondary, tone = 'neutral' }: StateProps) {
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.center}>
      <Ionicons name={icon} size={34} color={tone === 'error' ? colors.danger : colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.body}>{message}</Text>}
      {(actionLabel || secondaryLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} size="md" variant={tone === 'error' ? 'outline' : 'primary'} />}
          {secondaryLabel && onSecondary && <Button title={secondaryLabel} onPress={onSecondary} size="md" variant="ghost" />}
        </View>
      )}
    </Animated.View>
  );
}

export function EmptyState(props: Omit<StateProps, 'tone'>) {
  return <StateView {...props} />;
}

export function ErrorState({ message, onRetry, title = "Couldn't load this" }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <StateView
      tone="error"
      icon="cloud-offline-outline"
      title={title}
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
  inline: { paddingVertical: spacing.xl, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.huge, gap: spacing.sm, minHeight: 320 },
  title: { ...type.headline, textAlign: 'center', marginTop: spacing.sm },
  body: { ...type.callout, textAlign: 'center', maxWidth: 290, lineHeight: fs(20) },
  actions: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.xs, minWidth: 180 },
  }),
);
