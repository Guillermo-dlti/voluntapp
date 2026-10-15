import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { VolunteerQrCard } from '@/components/volunteer-qr-card';
import { SkeletonVolunteerDetail } from '@/components/skeleton';
import { roleCan } from '@/constants/roles';
import { useLargeText } from '@/hooks/use-large-text';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useFeedback } from '@/providers/feedback-provider';
import { ApiError, apiMessage } from '@/services/api';
import { getVolunteer, setVolunteerStatus, type HistoryEntry, type VolunteerDetail } from '@/services/volunteers';
import { ageFrom, formatDate, formatDateTime } from '@/utils/time';
import { formatPhone } from '@/utils/volunteer-rules';

const attendanceLabels: Record<NonNullable<HistoryEntry['attendance']>['status'], { label: string; tone: BadgeTone }> = {
  present: { label: 'Asistió', tone: 'success' },
  late: { label: 'Llegó tarde', tone: 'attention' },
  absent: { label: 'Faltó', tone: 'critical' },
};

function historyBadge(entry: HistoryEntry): { label: string; tone: BadgeTone } {
  if (entry.assignmentStatus === 'cancelled') return { label: 'Asignación cancelada', tone: 'neutral' };
  if (entry.activity.status === 'cancelled') return { label: 'Actividad cancelada', tone: 'neutral' };
  if (entry.attendance) return attendanceLabels[entry.attendance.status];
  return { label: 'Asignado', tone: 'neutral' };
}

function hoursLabel(hours: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(hours);
}

export default function VolunteerDetailScreen() {
  const router = useRouter();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const largeText = useLargeText();
  const [detail, setDetail] = useState<VolunteerDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getVolunteer(id));
      setMessage('');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  // Reload on focus, so returning from "Editar" shows the saved data.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function changeStatus(next: 'active' | 'inactive') {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy(true);
    try {
      const volunteer = await setVolunteerStatus(detail.volunteer.id, next);
      setDetail((current) => (current ? { ...current, volunteer } : current));
      setMessage('');
      feedback.toast(next === 'active' ? 'Voluntario reactivado.' : 'Voluntario desactivado. Su historial se conserva.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause, 'No pudimos cambiar el estado. Inténtalo de nuevo.'));
    } finally { pending.current = false; setBusy(false); }
  }

  function confirmDeactivate(name: string) {
    Alert.alert(
      `¿Desactivar a ${name}?`,
      'Ya no se le podrá asignar a actividades. Su historial y sus horas se conservan, y puedes reactivarle cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: () => void changeStatus('inactive') },
      ],
    );
  }

  if (!user) return null;
  const canEdit = roleCan.editVolunteers(user.role);

  if (!detail) {
    return (
      <Screen testID="volunteer-detail-screen" title="Voluntario" onBack={() => router.back()}>
        {message ? (
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir el registro" body={message}
            action={{ label: 'Reintentar', onPress: () => void load() }} />
        ) : <SkeletonVolunteerDetail />}
      </Screen>
    );
  }

  const { volunteer, history, totalHours, completedActivities } = detail;
  const fullName = `${volunteer.firstName} ${volunteer.lastName}`;
  const active = volunteer.status === 'active';

  return (
    <Screen testID="volunteer-detail-screen" title={fullName} titleTestID="volunteer-detail-name" onBack={() => router.back()}
      band={<StatusBadge label={active ? 'Activo' : 'Inactivo'} tone={active ? 'success' : 'neutral'} />}>
      <View style={[styles.stats, largeText && styles.stacked]}>
        <StatCard testID="volunteer-total-hours" label="Horas" value={hoursLabel(totalHours)} caption="con asistencia finalizada"
          icon={{ ios: 'clock', android: 'schedule' }} />
        <StatCard label="Actividades" value={String(completedActivities)} caption="completadas"
          icon={{ ios: 'checkmark.seal', android: 'task_alt' }} />
      </View>

      <Section title="Contacto" inset="icon">
        <Row emphasis="value" icon={{ ios: 'phone', android: 'call' }} label="Teléfono" value={formatPhone(volunteer.phone)}
          onPress={() => void Linking.openURL(`tel:${volunteer.phone}`)} />
        <Row emphasis="value" icon={{ ios: 'envelope', android: 'mail' }} label="Correo" value={volunteer.email ?? 'Sin correo'} />
        <Row emphasis="value" icon={{ ios: 'gift', android: 'cake' }} label="Fecha de nacimiento"
          value={volunteer.birthDate ? `${formatDate(volunteer.birthDate)} · ${ageFrom(volunteer.birthDate)} años` : 'Sin registrar'} />
      </Section>

      <Section title="Contacto de emergencia">
        <Row icon={{ ios: 'person', android: 'person' }} label={volunteer.emergencyContactName}
          value={formatPhone(volunteer.emergencyContactPhone)}
          onPress={() => void Linking.openURL(`tel:${volunteer.emergencyContactPhone}`)} />
      </Section>

      <Section title="Código de asistencia" bare>
        <VolunteerQrCard volunteer={volunteer} canRegenerate={canEdit}
          onPrint={canEdit ? () => router.push({ pathname: '/voluntarios/[id]/tarjeta', params: { id: volunteer.id } }) : undefined}
          onChanged={(next) => setDetail((current) => (current ? { ...current, volunteer: next } : current))} />
      </Section>

      {volunteer.notes ? (
        <Section title="Notas">
          <View style={styles.notes}><Text style={styles.notesText} selectable>{volunteer.notes}</Text></View>
        </Section>
      ) : null}

      <Section title="Historial" inset="icon" count={history.length ? String(history.length) : undefined} bare={history.length === 0}
        footer={history.length ? 'Las horas solo cuentan cuando la asistencia de la actividad está finalizada.' : undefined}>
        {history.length === 0 ? (
          <EmptyState icon={{ ios: 'calendar', android: 'event_note' }} title="Sin actividades todavía"
            body="Aquí verás cada actividad a la que se le asigne, con su asistencia y sus horas." />
        ) : history.map((entry) => {
          const badge = historyBadge(entry);
          const hours = entry.attendance?.finalized ? ` · ${hoursLabel(entry.attendance.hours)} h` : '';
          return (
            <Row key={entry.assignmentId} icon={{ ios: 'calendar', android: 'event' }} label={entry.activity.name}
              value={`${formatDateTime(entry.activity.startsAt)}${hours}`} trailing={<StatusBadge label={badge.label} tone={badge.tone} />} />
          );
        })}
      </Section>

      {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}

      {canEdit ? (
        <View style={styles.actions}>
          <Button testID="volunteer-edit" label="Editar datos" variant="secondary" icon={{ ios: 'pencil', android: 'edit' }}
            onPress={() => router.push({ pathname: '/voluntarios/[id]/editar', params: { id: volunteer.id } })} />
          {active ? (
            <Button testID="volunteer-deactivate" label="Desactivar" busyLabel="Desactivando…" busy={busy} variant="critical"
              icon={{ ios: 'person.crop.circle.badge.xmark', android: 'person_off' }} onPress={() => confirmDeactivate(volunteer.firstName)} />
          ) : (
            <Button testID="volunteer-reactivate" label="Reactivar" busyLabel="Reactivando…" busy={busy} variant="secondary"
              icon={{ ios: 'person.crop.circle.badge.checkmark', android: 'how_to_reg' }} onPress={() => void changeStatus('active')} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.md },
  stacked: { flexDirection: 'column' },
  notes: { padding: Spacing.lg },
  notesText: { ...Type.body, color: Brand.text },
  actions: { gap: Spacing.md },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: Radius.tile, paddingVertical: Spacing.md, paddingHorizontal: 14 },
  alertText: { ...Type.callout, color: Brand.dangerText },
});
