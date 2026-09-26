import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { roleLabels } from '@/constants/roles';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { firstName, greeting, todayLabel } from '@/utils/time';

export default function DashboardScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <View testID="home-screen" style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.band}>
        <Text style={styles.date}>{todayLabel()}</Text>
        <Text testID="home-greeting" style={styles.greeting}>{greeting()}, {firstName(user.fullName)}</Text>
        <View style={styles.roleChip}>
          <Text style={styles.roleText}>{roleLabels[user.role]}</Text>
        </View>
      </SafeAreaView>
      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Próximas actividades" bare>
          <EmptyState
            icon={{ ios: 'calendar', android: 'calendar_month' }}
            title="Sin actividades programadas"
            body="Cuando Coordinación publique actividades, aquí verás cada una con su horario y cupo."
          />
        </Section>
        <Section title="Asistencia por finalizar" footer="Las horas de un voluntario solo cuentan cuando su asistencia está finalizada.">
          <Row icon={{ ios: 'checkmark.circle', android: 'check_circle' }} label="Nada pendiente" value="No hay actividades esperando cierre de asistencia." />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.forest },
  band: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36, gap: 6 },
  date: { fontFamily: AppFonts.bodySemiBold, fontSize: 15, color: Brand.forestMuted },
  greeting: { fontFamily: AppFonts.heading, fontSize: 30, color: Brand.forestText, letterSpacing: -0.6, lineHeight: 36 },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: Brand.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roleText: { fontFamily: AppFonts.bodySemiBold, fontSize: 13, color: Brand.forest },
  body: { flex: 1, backgroundColor: Brand.background, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet },
  content: { padding: 20, paddingTop: 28, paddingBottom: 40, gap: 28 },
});
