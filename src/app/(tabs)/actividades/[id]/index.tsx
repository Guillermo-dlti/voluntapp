import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { ActivityStatusBadge } from '@/components/activity-status';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { ReasonDialog } from '@/components/reason-dialog';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  cancelAssignment, getActivity, setActivityStatus,
  type ActivityDetail, type ActivityStatus, type Participant,
} from '@/services/activities';
import { formatSchedule } from '@/utils/time';
import { formatPhone } from '@/utils/volunteer-rules';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<ActivityStatus | null>(null);
  const [cancelling, setCancelling] = useState<Participant | null>(null);
  const pending = useRef(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getActivity(id));
      setMessage('');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  // Reload on focus, so returning from "Editar" or "Asignar" shows the new state.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function changeStatus(next: ActivityStatus) {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy(next);
    try {
      const activity = await setActivityStatus(detail.activity.id, next);
      setDetail((current) => (current ? { ...current, activity } : current));
      setMessage('');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause, 'No pudimos cambiar el estado. Inténtalo de nuevo.'));
      void load();
    } finally { pending.current = false; setBusy(null); }
  }

  function confirm(title: string, body: string, action: string, next: ActivityStatus) {
    Alert.alert(title, body, [
      { text: 'Volver', style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => void changeStatus(next) },
    ]);
  }

  async function cancelParticipant(reason: string): Promise<string | null> {
    if (!cancelling || !detail) return null;
    try {
      await cancelAssignment(detail.activity.id, cancelling.assignmentId, reason);
      setCancelling(null);
      await load();
      return null;
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { setCancelling(null); void refresh(); return null; }
      return apiMessage(cause, 'No pudimos cancelar la asignación. Inténtalo de nuevo.');
    }
  }

  if (!user) return null;

  if (!detail) {
    return (
      <Screen testID="activity-detail-screen" title="Actividad" onBack={() => router.back()}>
        {message ? (
          <View style={styles.block}>
            <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir la actividad" body={message} />
            <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
          </View>
        ) : <ActivityIndicator color={Brand.primary} />}
      </Screen>
    );
  }

  const { activity, supervisor, participants } = detail;
  const canEdit = roleCan.editActivities(user.role);
  const canAssign = roleCan.assignVolunteers(user.role) && activity.status === 'open';
  const editable = activity.status === 'draft' || activity.status === 'open';
  const assigned = participants.filter((entry) => entry.status === 'assigned');
  const cancelled = participants.filter((entry) => entry.status === 'cancelled');
  const free = activity.capacity - activity.assignedCount;

  return (
    <Screen testID="activity-detail-screen" title={activity.name} titleTestID="activity-detail-name" onBack={() => router.back()}
      band={<ActivityStatusBadge status={activity.status} />}>

      <Section title="Detalles">
        <Row icon={{ ios: 'calendar', android: 'event' }} label="Horario" value={formatSchedule(activity.startsAt, activity.endsAt)} />
        <Row icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Lugar" value={activity.location} />
        <Row icon={{ ios: 'person.badge.shield.checkmark', android: 'supervisor_account' }} label="Supervisión"
          value={supervisor?.fullName ?? 'Sin supervisor'} />
        {activity.description ? <Row icon={{ ios: 'text.alignleft', android: 'notes' }} label="Descripción" value={activity.description} /> : null}
        {activity.requirements ? <Row icon={{ ios: 'checklist', android: 'checklist' }} label="Requisitos" value={activity.requirements} /> : null}
      </Section>

      {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}

      {canEdit && editable ? (
        <View style={styles.actions}>
          {activity.status === 'draft' ? (
            <Button testID="activity-publish" label="Publicar" busyLabel="Publicando…" busy={busy === 'open'}
              icon={{ ios: 'paperplane', android: 'publish' }} onPress={() => void changeStatus('open')} />
          ) : null}
          {activity.status === 'open' ? (
            <Button testID="activity-close" label="Cerrar actividad" busyLabel="Cerrando…" busy={busy === 'closed'} variant="secondary"
              icon={{ ios: 'checkmark.circle', android: 'task_alt' }}
              onPress={() => confirm('¿Cerrar la actividad?', 'Ya no se podrá editar, asignar ni volver a abrir. Las asignaciones se conservan.', 'Cerrar', 'closed')} />
          ) : null}
          {activity.status === 'open' && activity.assignedCount === 0 ? (
            <Button testID="activity-unpublish" label="Volver a borrador" busyLabel="Guardando…" busy={busy === 'draft'} variant="secondary"
              icon={{ ios: 'arrow.uturn.backward', android: 'undo' }} onPress={() => void changeStatus('draft')} />
          ) : null}
          <Button testID="activity-edit" label="Editar datos" variant="secondary" icon={{ ios: 'pencil', android: 'edit' }}
            onPress={() => router.push({ pathname: '/actividades/[id]/editar', params: { id: activity.id } })} />
          <Button testID="activity-cancel" label="Cancelar actividad" busyLabel="Cancelando…" busy={busy === 'cancelled'} variant="critical"
            icon={{ ios: 'xmark.circle', android: 'event_busy' }}
            onPress={() => confirm('¿Cancelar la actividad?', 'No se puede deshacer. Las asignaciones y su historial se conservan, y la actividad deja de ocupar el horario de esas personas.', 'Cancelar actividad', 'cancelled')} />
        </View>
      ) : null}

      <View style={styles.stats}>
        <StatCard testID="activity-assigned-count" label="Asignados" value={`${activity.assignedCount}/${activity.capacity}`}
          caption={free > 0 ? `${free} ${free === 1 ? 'lugar libre' : 'lugares libres'}` : 'Cupo lleno'}
          icon={{ ios: 'person.2', android: 'group' }} />
      </View>

      <Section title="Participantes" bare={assigned.length === 0}
        footer={activity.status === 'draft' && canEdit ? 'Publica la actividad para poder asignar voluntarios.'
          : canAssign && free <= 0 ? 'Cupo lleno. Para asignar a alguien más, aumenta el cupo o cancela una asignación.' : undefined}>
        {assigned.length === 0 ? (
          <EmptyState icon={{ ios: 'person.2', android: 'group' }} title="Nadie asignado todavía"
            body={canAssign ? 'Asigna voluntarios activos con el botón “Asignar voluntario”.' : 'Cuando Coordinación asigne voluntarios, aparecerán aquí con su teléfono.'} />
        ) : assigned.map((entry) => (
          <Row key={entry.assignmentId} testID={`participant-${entry.volunteerId}`}
            leading={<Avatar name={`${entry.firstName} ${entry.lastName}`} />}
            label={`${entry.firstName} ${entry.lastName}`} value={formatPhone(entry.phone)}
            onPress={() => participantMenu(entry)} />
        ))}
      </Section>

      {canAssign && free > 0 ? (
        <Button testID="activity-assign" label="Asignar voluntario" icon={{ ios: 'person.badge.plus', android: 'person_add' }}
          onPress={() => router.push({ pathname: '/actividades/[id]/asignar', params: { id: activity.id } })} />
      ) : null}

      {cancelled.length ? (
        <Section title="Cancelados">
          {cancelled.map((entry) => (
            <Row key={entry.assignmentId} leading={<Avatar name={`${entry.firstName} ${entry.lastName}`} />}
              label={`${entry.firstName} ${entry.lastName}`} value={entry.cancelledReason ? `Motivo: ${entry.cancelledReason}` : undefined} />
          ))}
        </Section>
      ) : null}

      <Section title="Asistencia" bare>
        <EmptyState icon={{ ios: 'checklist', android: 'fact_check' }} title="La asistencia llega pronto"
          body="Aquí vas a marcar quién asistió, con sus horas, y finalizar la asistencia. Se activa en la siguiente versión." />
      </Section>

      <ReasonDialog testID="cancel-assignment" visible={cancelling !== null}
        title={cancelling ? `¿Cancelar la asignación de ${cancelling.firstName}?` : ''}
        body="Su registro se conserva con el motivo, y le puedes volver a asignar después."
        confirmLabel="Sí, cancelar" busyLabel="Cancelando…"
        onConfirm={cancelParticipant} onClose={() => setCancelling(null)} />
    </Screen>
  );

  // Tapping a participant offers the actions for them: call, or cancel their assignment.
  function participantMenu(entry: Participant) {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Llamar', onPress: () => void Linking.openURL(`tel:${entry.phone}`) },
    ];
    if (canAssign) options.push({ text: 'Cancelar asignación', style: 'destructive', onPress: () => setCancelling(entry) });
    options.push({ text: 'Volver', style: 'cancel' });
    Alert.alert(`${entry.firstName} ${entry.lastName}`, formatPhone(entry.phone), options);
  }
}

const styles = StyleSheet.create({
  block: { gap: 16 },
  stats: { flexDirection: 'row', gap: 12 },
  actions: { gap: 12 },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
