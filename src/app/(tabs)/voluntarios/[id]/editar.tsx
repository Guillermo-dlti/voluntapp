import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { VolunteerForm } from '@/components/volunteer-form';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { getVolunteer, updateVolunteer, type Volunteer } from '@/services/volunteers';
import { draftToPayload, editablePhone, type VolunteerDraft } from '@/utils/volunteer-rules';

function toDraft(volunteer: Volunteer): VolunteerDraft {
  return {
    firstName: volunteer.firstName,
    lastName: volunteer.lastName,
    phone: editablePhone(volunteer.phone),
    email: volunteer.email ?? '',
    birthDate: volunteer.birthDate ?? '',
    emergencyContactName: volunteer.emergencyContactName,
    emergencyContactPhone: editablePhone(volunteer.emergencyContactPhone),
    notes: volunteer.notes ?? '',
  };
}

export default function EditVolunteerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try { setVolunteer((await getVolunteer(id)).volunteer); }
    catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen testID="volunteer-edit-screen" title="Editar voluntario"
      subtitle={volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : undefined} onBack={() => router.back()}>
      {volunteer ? (
        <VolunteerForm initial={toDraft(volunteer)} submitLabel="Guardar cambios" busyLabel="Guardando…"
          onSessionEnded={() => void refresh()}
          onSubmit={async (draft) => { await updateVolunteer(volunteer.id, draftToPayload(draft)); router.back(); }} />
      ) : message ? (
        <View style={styles.block}>
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir el registro" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
        </View>
      ) : <ActivityIndicator color={Brand.primary} />}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: 16 } });
