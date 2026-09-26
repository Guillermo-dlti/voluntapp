import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ActivityForm } from '@/components/activity-form';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { getActivity, updateActivity, type Activity } from '@/services/activities';
import { activityPayload, draftFromActivity } from '@/utils/activity-rules';

export default function EditActivityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try { setActivity((await getActivity(id)).activity); }
    catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  useEffect(() => { void load(); }, [load]);

  const editable = activity && (activity.status === 'draft' || activity.status === 'open');

  return (
    <Screen testID="activity-edit-screen" title="Editar actividad" subtitle={activity?.name} onBack={() => router.back()}>
      {activity && editable ? (
        <ActivityForm initial={draftFromActivity(activity)} submitLabel="Guardar cambios" busyLabel="Guardando…"
          onSessionEnded={() => void refresh()}
          onSubmit={async (draft) => { await updateActivity(activity.id, activityPayload(draft)); router.back(); }} />
      ) : activity ? (
        <EmptyState icon={{ ios: 'lock', android: 'lock' }} title="Ya no se puede editar"
          body="Solo se editan actividades en borrador o publicadas. Esta ya está cerrada o cancelada." />
      ) : message ? (
        <View style={styles.block}>
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir la actividad" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
        </View>
      ) : <ActivityIndicator color={Brand.primary} />}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: 16 } });
