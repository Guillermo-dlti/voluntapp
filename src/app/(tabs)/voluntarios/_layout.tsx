import { Stack } from 'expo-router';

import { Brand } from '@/constants/theme';

// List → detail → form inside the Voluntarios tab. Each screen draws its own header band.
export default function VolunteersLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Brand.forest } }} />;
}
