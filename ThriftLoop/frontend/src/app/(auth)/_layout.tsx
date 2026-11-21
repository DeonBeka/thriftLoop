import { Redirect, Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { user } = useAuth();
  // Signed-in (and therefore verified) users never see the auth screens.
  if (user) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
