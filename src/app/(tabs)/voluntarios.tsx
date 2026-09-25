import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function VolunteersScreen() {
  return (
    <ScreenPlaceholder
      testID="volunteers-screen"
      title="Voluntarios"
      subtitle="Registro y seguimiento de personas voluntarias"
      upcoming={[
        'Buscar por nombre, correo o teléfono y filtrar por estado',
        'Registrar y editar voluntarios',
        'Desactivar y reactivar (sin borrar su historial)',
        'Detalle con historial de participación y horas acumuladas',
      ]}
    />
  );
}
