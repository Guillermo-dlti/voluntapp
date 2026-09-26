import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function VolunteersScreen() {
  return (
    <Screen testID="volunteers-screen" title="Voluntarios" subtitle="Personas voluntarias registradas en BAMX">
      <EmptyState
        icon={{ ios: 'person.2', android: 'group' }}
        title="Todavía no hay voluntarios"
        body="Aquí vas a registrar a las personas voluntarias y consultar su historial y sus horas. Esta sección llega en la siguiente versión."
      />
    </Screen>
  );
}
