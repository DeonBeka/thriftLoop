import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Logo } from '@/components/ui/Logo';
import { colors, isDark, type } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { FavoritesProvider } from '@/hooks/useFavorites';

function RootNavigator() {
  const { initializing } = useAuth();
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });

  // Wait for the serif headings so titles don't flash in the system font. If fonts fail, carry on.
  if (initializing || (!fontsLoaded && !fontError)) {
    // Same look as the native splash, so launch doesn't flash a spinner.
    return (
      <View style={styles.splash}>
        <Logo variant="mark" size={64} />
      </View>
    );
  }

  return (
    // Expo Router's Stack is a native stack (UINavigationController on iOS): pushes slide in from the
    // right and the left-edge swipe-back is the real interactive gesture — the screen tracks the finger
    // and cancels if you drag back. Full-screen swipe stays off so horizontal galleries keep working.
    <Stack
      screenOptions={{
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
        animation: 'default',
        headerTintColor: colors.primary,
        headerTitleStyle: { ...type.headline },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
      <Stack.Screen name="messages/[id]" options={{ title: '' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance & accessibility' }} />
      <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
      <Stack.Screen name="orders/index" options={{ title: 'Orders' }} />
      <Stack.Screen name="orders/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="checkout/[id]" options={{ title: 'Checkout' }} />
      <Stack.Screen name="seller/apply" options={{ title: 'Become a seller', presentation: 'modal' }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      {/* Editing flows are sheets: swipe down to dismiss, like iOS Mail/Notes. */}
      <Stack.Screen name="product/edit/[id]" options={{ title: 'Edit listing', presentation: 'modal' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <FavoritesProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <RootNavigator />
          </FavoritesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
