import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function ActivitiesScreen() {
  return (
    <ScreenPlaceholder
      testID="activities-screen"
      title="Actividades"
      subtitle="Turnos, cupos y asistencia"
      upcoming={[
        'Crear y editar actividades con cupo y horario',
        'Asignar voluntarios respetando el cupo y sin traslapes',
        'Registrar asistencia y horas, y finalizarla',
      ]}
    />
  );
}
