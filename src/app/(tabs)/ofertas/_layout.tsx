import { Stack } from 'expo-router';

export default function OfertasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="detalles" />
      <Stack.Screen name="confirmacion" />
    </Stack>
  );
}
