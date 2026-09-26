import { useRouter } from 'expo-router';

import { ActivityForm } from '@/components/activity-form';
import { Screen } from '@/components/screen';
import { useAuth } from '@/providers/auth-provider';
import { createActivity } from '@/services/activities';
import { activityPayload, emptyActivityDraft } from '@/utils/activity-rules';

export default function NewActivityScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  return (
    <Screen testID="activity-new-screen" title="Nueva actividad" subtitle="Se guarda como borrador. Publícala cuando esté lista para asignar."
      onBack={() => router.back()}>
      <ActivityForm initial={emptyActivityDraft} submitLabel="Crear actividad" busyLabel="Creando…"
        onSessionEnded={() => void refresh()}
        onSubmit={async (draft) => {
          const activity = await createActivity(activityPayload(draft));
          // Replace the form, so "back" from the new activity returns to the list, not to a filled form.
          router.replace({ pathname: '/actividades/[id]', params: { id: activity.id } });
        }} />
    </Screen>
  );
}
