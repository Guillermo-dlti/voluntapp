import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { roleLabels } from '@/constants/roles';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { firstName, greeting, todayLabel } from '@/utils/time';

export default function DashboardScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Screen testID="home-screen" eyebrow={todayLabel()} title={`${greeting()}, ${firstName(user.fullName)}`} titleTestID="home-greeting"
      band={<View style={styles.roleChip}><Text style={styles.roleText}>{roleLabels[user.role]}</Text></View>}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleChip: { alignSelf: 'flex-start', backgroundColor: Brand.accent, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  roleText: { fontFamily: AppFonts.bodySemiBold, fontSize: 13, color: Brand.forest },
});
