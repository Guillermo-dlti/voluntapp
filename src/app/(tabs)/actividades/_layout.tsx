import { Stack } from 'expo-router';

import { Brand } from '@/constants/theme';

// List → detail → form and assign inside the Actividades tab. Each screen draws its own header band.
export default function ActivitiesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Brand.forest } }} />;
}
