import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function ActivitiesScreen() {
  return (
    <Screen testID="activities-screen" title="Actividades" subtitle="Turnos, cupos y asistencia">
      <EmptyState
        icon={{ ios: 'calendar', android: 'calendar_month' }}
        title="No hay actividades"
        body="Aquí vas a crear turnos con horario y cupo, asignar voluntarios y tomar asistencia. Esta sección llega en la siguiente versión."
      />
    </Screen>
  );
}
