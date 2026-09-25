import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Geist_400Regular, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { Brand } from '@/constants/theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  
  const [fontsLoaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Geist_400Regular,
    Geist_600SemiBold,
  });

  if (!fontsLoaded) {
    // Briefly blank instead of a flash of system-font text before swapping
    // to the real fonts once they finish loading.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <SessionNavigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
function SessionNavigation() {
  const { user, status, error, refresh } = useAuth();
  if (status !== 'ready') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: Brand.background }}>
        {status === 'loading' ? <ActivityIndicator color={Brand.primary} /> : <>
          <Text accessibilityRole="alert" style={{ color: Brand.text, textAlign: 'center' }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()} style={{ padding: 16 }}>
            <Text style={{ color: Brand.primary }}>Reintentar</Text>
          </Pressable>
        </>}
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
