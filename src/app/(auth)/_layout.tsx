import { Stack } from 'expo-router';

// Stack for the pre-login flow: Welcome is the entry point, then either
// Login or Sign Up. 
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}