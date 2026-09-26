import { Stack } from 'expo-router';

// Signed-out stack: staff accounts are created by an admin, so login is the only screen.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
