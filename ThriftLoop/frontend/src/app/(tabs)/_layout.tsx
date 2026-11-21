import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import { TermsGate } from '@/components/legal/TermsGate';
import { colors, fs } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { haptic } from '@/utils/haptics';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, activeName: IconName, size = 24) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? activeName : name} size={size} color={color as string} />
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  // Protected area: only signed-in users get past here.
  if (!user) return <Redirect href="/welcome" />;
  if (!user.terms_accepted_at) return <TermsGate />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: fs(10.5), fontWeight: '600', letterSpacing: 0.1 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
      screenListeners={{ tabPress: () => void haptic.selection() }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: tabIcon('search-outline', 'search') }} />
      <Tabs.Screen name="sell" options={{ title: 'Sell', tabBarIcon: tabIcon('add-circle-outline', 'add-circle', 27) }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites', tabBarIcon: tabIcon('heart-outline', 'heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
