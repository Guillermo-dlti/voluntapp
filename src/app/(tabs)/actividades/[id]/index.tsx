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
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  cancelAssignment, finalizeAttendance, getActivity, markAllPresent, missingPeople, setActivityStatus,
  type ActivityDetail, type ActivityStatus, type AttendanceStatus, type MissingPerson, type Participant,
} from '@/services/activities';
import { attendanceStatusLabels, hoursText } from '@/utils/attendance-rules';
import { formatDateTime, formatSchedule } from '@/utils/time';

const attendanceTones: Record<AttendanceStatus, BadgeTone> = { present: 'success', late: 'attention', absent: 'critical' };
import { formatPhone } from '@/utils/volunteer-rules';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<ActivityStatus | 'mark-all' | 'finalize' | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [missing, setMissing] = useState<MissingPerson[]>([]);
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

  async function markAll() {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy('mark-all');
    setAttendanceMessage('');
    setMissing([]);
    try {
      await markAllPresent(detail.activity.id);
      await load();
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setAttendanceMessage(apiMessage(cause, 'No pudimos marcar la asistencia. Inténtalo de nuevo.'));
    } finally { pending.current = false; setBusy(null); }
  }

  async function finalize() {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy('finalize');
    setAttendanceMessage('');
    setMissing([]);
    try {
      await finalizeAttendance(detail.activity.id);
      await load();
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setAttendanceMessage(apiMessage(cause, 'No pudimos finalizar la asistencia. Inténtalo de nuevo.'));
      setMissing(missingPeople(cause));
      void load();
    } finally { pending.current = false; setBusy(null); }
  }

  function confirmFinalize() {
    Alert.alert('¿Finalizar la asistencia?',
      'Las horas se vuelven oficiales y cuentan en el total de cada voluntario. La actividad se cierra y ya no se puede asignar a nadie. Después, solo Administración puede corregir un registro.',
      [{ text: 'Volver', style: 'cancel' }, { text: 'Finalizar', onPress: () => void finalize() }]);
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

      {attendanceSection()}

      <ReasonDialog testID="cancel-assignment" visible={cancelling !== null}
        title={cancelling ? `¿Cancelar la asignación de ${cancelling.firstName}?` : ''}
        body="Su registro se conserva con el motivo, y le puedes volver a asignar después."
        confirmLabel="Sí, cancelar" busyLabel="Cancelando…"
        onConfirm={cancelParticipant} onClose={() => setCancelling(null)} />
    </Screen>
  );

  function attendanceSection() {
    if (!user) return null;
    if (activity.status === 'draft' || activity.status === 'cancelled') {
      return (
        <Section title="Asistencia" footer={activity.status === 'draft'
          ? 'La asistencia se registra cuando la actividad está publicada y ya empezó.'
          : 'Una actividad cancelada no lleva asistencia.'} bare>{null}</Section>
      );
    }
    if (new Date(activity.startsAt) > new Date()) {
      return (
        <Section title="Asistencia" bare>
          <EmptyState icon={{ ios: 'clock', android: 'schedule' }} title="La asistencia se abre al empezar"
            body={`Podrás marcar quién asistió a partir del ${formatDateTime(activity.startsAt)}.`} />
        </Section>
      );
    }
    if (assigned.length === 0) {
      return (
        <Section title="Asistencia" bare>
          <EmptyState icon={{ ios: 'checklist', android: 'fact_check' }} title="Nadie a quien tomar asistencia"
            body="La asistencia se registra para las personas asignadas. Asigna voluntarios para poder tomarla." />
        </Section>
      );
    }
    const finalized = activity.attendanceFinalizedAt !== null;
    const canRecord = !finalized && roleCan.recordAttendance(user.role, activity.supervisorId, user.id);
    const canCorrect = finalized && roleCan.correctAttendance(user.role);
    const recorded = assigned.filter((entry) => entry.attendance !== null).length;
    const footer = activity.attendanceFinalizedAt
      ? `Asistencia finalizada el ${formatDateTime(activity.attendanceFinalizedAt)}${canCorrect ? ' Toca a una persona para corregir su registro.' : ''}`
      : `${recorded} de ${assigned.length} registrados.${canRecord ? ' Toca a una persona para registrar o cambiar su asistencia.' : ''}`;
    const open = (entry: Participant) => router.push({
      pathname: '/actividades/[id]/asistencia/[assignmentId]', params: { id: activity.id, assignmentId: entry.assignmentId },
    });
    return (
      <>
        <Section title="Asistencia" footer={footer}>
          {assigned.map((entry) => (
            <Row key={entry.assignmentId} testID={`attendance-${entry.volunteerId}`}
              leading={<Avatar name={`${entry.firstName} ${entry.lastName}`} />}
              label={`${entry.firstName} ${entry.lastName}`}
              value={entry.attendance ? `${hoursText(entry.attendance.hours)} h${entry.attendance.correctionReason ? ' · corregido' : ''}` : undefined}
              trailing={entry.attendance
                ? <StatusBadge label={attendanceStatusLabels[entry.attendance.status]} tone={attendanceTones[entry.attendance.status]} />
                : <StatusBadge label="Sin registrar" tone="neutral" />}
              onPress={canRecord || canCorrect ? () => open(entry) : undefined} />
          ))}
        </Section>
        {attendanceMessage ? (
          <View accessibilityRole="alert" style={styles.alert}>
            <Text style={styles.alertText}>{attendanceMessage}</Text>
            {missing.map((person) => <Text key={person.assignmentId} style={styles.alertText}>· {person.firstName} {person.lastName}</Text>)}
          </View>
        ) : null}
        {canRecord ? (
          <View style={styles.actions}>
            {recorded < assigned.length ? (
              <Button testID="attendance-mark-all" label="Marcar todos presentes" busyLabel="Marcando…" busy={busy === 'mark-all'}
                variant="secondary" icon={{ ios: 'checkmark.circle', android: 'done_all' }} onPress={() => void markAll()} />
            ) : null}
            <Button testID="attendance-finalize" label="Finalizar asistencia" busyLabel="Finalizando…" busy={busy === 'finalize'}
              icon={{ ios: 'lock', android: 'lock' }} onPress={confirmFinalize} />
          </View>
        ) : null}
      </>
    );
  }

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
  alert: { gap: 4, backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
