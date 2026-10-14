import { Stack } from 'expo-router';

import { Brand } from '@/constants/theme';

// Summary → full lists inside the Reportes tab. The range travels as `from`/`to` params.
export default function ReportsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Brand.forest } }} />;
}
