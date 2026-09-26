import { useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { VolunteerForm } from '@/components/volunteer-form';
import { useAuth } from '@/providers/auth-provider';
import { createVolunteer } from '@/services/volunteers';
import { draftToPayload, emptyDraft } from '@/utils/volunteer-rules';

export default function NewVolunteerScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  return (
    <Screen testID="volunteer-new-screen" title="Nuevo voluntario" subtitle="Los campos sin “opcional” son obligatorios."
      onBack={() => router.back()}>
      <VolunteerForm initial={emptyDraft} submitLabel="Registrar voluntario" busyLabel="Registrando…"
        onSessionEnded={() => void refresh()}
        onSubmit={async (draft) => {
          const volunteer = await createVolunteer(draftToPayload(draft));
          // Replace the form, so "back" from the new record returns to the list, not to a filled form.
          router.replace({ pathname: '/voluntarios/[id]', params: { id: volunteer.id } });
        }} />
    </Screen>
  );
}
