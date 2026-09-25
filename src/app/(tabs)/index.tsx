import { StyleSheet, Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function DashboardScreen() {
  const { user } = useAuth();
  return (
    <ScreenPlaceholder
      testID="home-screen"
      title="Inicio"
      subtitle="Panel de control del Banco de Alimentos"
      upcoming={[
        'Indicadores: voluntarios activos, actividades y horas del mes',
        'Próximas actividades',
        'Actividades con asistencia pendiente de finalizar',
      ]}>
      <View style={styles.greetingBox}>
        <Text testID="home-greeting" style={styles.greeting}>Hola de nuevo,</Text>
        <Text style={styles.name}>{user?.name}</Text>
      </View>
    </ScreenPlaceholder>
  );
}

const styles = StyleSheet.create({
  greetingBox: { gap: 2 },
  greeting: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.textSecondary },
  name: { fontFamily: AppFonts.headingSemiBold, fontSize: 20, color: Brand.text },
});
