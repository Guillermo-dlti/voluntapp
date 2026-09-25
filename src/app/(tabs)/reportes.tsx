import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function ReportsScreen() {
  return (
    <Screen testID="reports-screen" title="Reportes" subtitle="Horas y participación">
      <EmptyState
        icon={{ ios: 'chart.bar', android: 'bar_chart' }}
        title="Aún no hay datos para reportar"
        body="Cuando haya asistencia finalizada, aquí verás las horas por voluntario y por actividad, y podrás exportarlas a CSV."
      />
    </Screen>
  );
}
