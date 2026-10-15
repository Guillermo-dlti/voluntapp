import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Geist_400Regular, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Button } from '@/components/button';
import { AppFonts, Brand, Motion } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { FeedbackProvider } from '@/providers/feedback-provider';

// The native splash (forest with the BAMX logo, app.json) stays up until the fonts are in and the
// saved session has been checked, then fades into the first screen, which is forest too. No white
// flash and no flash of system font.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: Motion.duration, fade: true });

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Geist_400Regular,
    Geist_600SemiBold,
  });

  // A font that fails to load falls back to the system font rather than holding the splash forever.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <FeedbackProvider>
          <SessionNavigation />
        </FeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function SessionNavigation() {
  const { user, status, error, refresh } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status !== 'ready') {
    // While the splash is still up this is never seen; on web (no native splash) it stands in for it.
    return (
      <View style={styles.splash}>
        <Image source={require('@/assets/images/bamx-logo.png')} style={styles.logo} contentFit="contain"
          accessibilityLabel="Banco de Alimentos de Guadalajara" />
        {status === 'error' ? (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Button label="Reintentar" variant="secondary" onPress={() => void refresh()} />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24, backgroundColor: Brand.forest },
  // Same width as the native splash image (imageWidth in app.json), so the hand-off doesn't jump.
  logo: { width: 120, height: 136 },
  error: { alignSelf: 'stretch', gap: 16 },
  errorText: { fontFamily: AppFonts.body, fontSize: 16, lineHeight: 22, color: Brand.forestText, textAlign: 'center' },
});
