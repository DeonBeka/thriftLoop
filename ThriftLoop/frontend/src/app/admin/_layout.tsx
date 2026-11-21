import { Stack } from 'expo-router';

import { ErrorState } from '@/components/ui/States';
import { colors, type } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const { user } = useAuth();
  // The server enforces this too; the guard just avoids showing an empty dashboard.
  if (user?.role !== 'admin') return <ErrorState title="Admins only" message="You don't have access to this area." />;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { ...type.headline },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="application/[id]" options={{ title: 'Review application' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
    </Stack>
  );
}
