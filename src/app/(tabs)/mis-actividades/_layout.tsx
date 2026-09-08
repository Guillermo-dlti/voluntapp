import { Stack } from 'expo-router';

export default function MisActividadesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="check-in" />
    </Stack>
  );
}
