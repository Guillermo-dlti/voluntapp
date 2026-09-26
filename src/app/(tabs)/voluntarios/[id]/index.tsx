import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refresh } = useAuth();
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
          <View style={styles.block}>
            <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir el registro" body={message} />
            <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
          </View>
        ) : <ActivityIndicator color={Brand.primary} />}
      </Screen>
    );
  }

  const { volunteer, history, totalHours, completedActivities } = detail;
  const fullName = `${volunteer.firstName} ${volunteer.lastName}`;
  const active = volunteer.status === 'active';

  return (
    <Screen testID="volunteer-detail-screen" title={fullName} titleTestID="volunteer-detail-name" onBack={() => router.back()}
      band={<StatusBadge label={active ? 'Activo' : 'Inactivo'} tone={active ? 'success' : 'neutral'} />}>
      <View style={styles.stats}>
        <StatCard testID="volunteer-total-hours" label="Horas" value={hoursLabel(totalHours)} caption="con asistencia finalizada"
          icon={{ ios: 'clock', android: 'schedule' }} />
        <StatCard label="Actividades" value={String(completedActivities)} caption="completadas"
          icon={{ ios: 'checkmark.seal', android: 'task_alt' }} />
      </View>

      <Section title="Contacto">
        <Row icon={{ ios: 'phone', android: 'call' }} label="Teléfono" value={formatPhone(volunteer.phone)}
          onPress={() => void Linking.openURL(`tel:${volunteer.phone}`)} />
        <Row icon={{ ios: 'envelope', android: 'mail' }} label="Correo" value={volunteer.email ?? 'Sin correo'} />
        <Row icon={{ ios: 'gift', android: 'cake' }} label="Fecha de nacimiento"
          value={volunteer.birthDate ? `${formatDate(volunteer.birthDate)} · ${ageFrom(volunteer.birthDate)} años` : 'Sin registrar'} />
      </Section>

      <Section title="Contacto de emergencia">
        <Row icon={{ ios: 'person', android: 'person' }} label={volunteer.emergencyContactName}
          value={formatPhone(volunteer.emergencyContactPhone)}
          onPress={() => void Linking.openURL(`tel:${volunteer.emergencyContactPhone}`)} />
      </Section>

      {volunteer.notes ? (
        <Section title="Notas">
          <View style={styles.notes}><Text style={styles.notesText} selectable>{volunteer.notes}</Text></View>
        </Section>
      ) : null}

      <Section title="Historial" bare={history.length === 0}
        footer={history.length ? 'Las horas solo cuentan cuando la asistencia de la actividad está finalizada.' : undefined}>
        {history.length === 0 ? (
          <EmptyState icon={{ ios: 'calendar', android: 'event_note' }} title="Sin actividades todavía"
            body="Cuando se le asigne a una actividad, aquí verás cada una con su asistencia y sus horas." />
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
  block: { gap: 16 },
  stats: { flexDirection: 'row', gap: 12 },
  notes: { padding: 16 },
  notesText: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.text, lineHeight: 22 },
  actions: { gap: 12 },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
