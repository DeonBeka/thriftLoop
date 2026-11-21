import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from '@expo-google-fonts/fraunces';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Animated, { FadeOut } from 'react-native-reanimated';
import { Appearance, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { VoiceGuide } from '@/components/accessibility/VoiceGuide';
import { Logo } from '@/components/ui/Logo';
import { applyTheme, colors, subscribeTheme, themed, themeNav, themeState, type } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { FavoritesProvider } from '@/hooks/useFavorites';
import { getPreferences } from '@/services/preferences';

const getVersion = () => themeState.version;

function RootNavigator() {
  const { initializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
  const ready = !initializing && (fontsLoaded || !!fontError);

  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // After a live theme change the screens re-mount at Home; put the user back where they were.
  // Wait a beat so the new navigator has settled (incl. the tabs' auth redirect) before navigating.
  useEffect(() => {
    if (!ready || !themeNav.returnTo) return;
    const target = themeNav.returnTo;
    themeNav.returnTo = null;
    const t = setTimeout(() => {
      if (pathRef.current === target) return; // navigation state survived the re-mount
      router.push('/settings');
      setTimeout(() => router.push(target as '/appearance'), 50);
    }, 300);
    return () => clearTimeout(t);
  }, [ready, router]);

  // Wait for the serif headings so titles don't flash in the system font. If fonts fail, carry on.
  if (!ready) {
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
      <Stack.Screen name="assistant" options={{ title: 'AI stylist' }} />
      <Stack.Screen name="live-view/[id]" options={{ title: 'Live view' }} />
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
  // Bumps whenever Appearance settings change; re-keying re-mounts the screens with fresh styles
  // (sign-in, favorites and cached data live above this point, so nothing is lost).
  const themeVersion = useSyncExternalStore(subscribeTheme, getVersion, getVersion);

  // Brief cover while the screens re-mount after a theme change, so no in-between screen flickers.
  const [switching, setSwitching] = useState(false);
  const firstVersion = useRef(themeVersion);
  useEffect(() => {
    if (themeVersion === firstVersion.current) return;
    setSwitching(true);
    const t = setTimeout(() => setSwitching(false), 600);
    return () => clearTimeout(t);
  }, [themeVersion]);

  // "Automatic" theme follows the iPhone's light/dark switch while the app is open.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {
      if (getPreferences().theme === 'system') applyTheme(getPreferences());
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <FavoritesProvider>
            <StatusBar style={themeState.isDark ? 'light' : 'dark'} />
            <VoiceGuide />
            <RootNavigator key={themeVersion} />
            {switching && (
              <Animated.View
                exiting={FadeOut.duration(250)}
                style={[StyleSheet.absoluteFill, styles.splash]}
                pointerEvents="none"
              >
                <Logo variant="mark" size={56} />
              </Animated.View>
            )}
          </FavoritesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  }),
);
