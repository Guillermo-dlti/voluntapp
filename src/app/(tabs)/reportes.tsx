import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function ReportsScreen() {
  return (
    <ScreenPlaceholder
      testID="reports-screen"
      title="Reportes"
      subtitle="Horas y participación"
      upcoming={[
        'Horas por voluntario y asistencia por actividad',
        'Participación por rango de fechas',
        'Exportar a CSV y compartir desde el teléfono',
      ]}
    />
  );
}
