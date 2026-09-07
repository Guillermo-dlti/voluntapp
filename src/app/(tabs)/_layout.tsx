import { Stack } from 'expo-router';

// TEMPORARY placeholder — real 5-tab navigation (Inicio, Ofertas, Mis Act.,
// Impacto, Perfil) goes here in a later step, once we build the actual tab
// screens. This just gives the root Stack a valid "(tabs)" route to point
// to so the app doesn't crash while (auth) screens are being built.
export default function TabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}