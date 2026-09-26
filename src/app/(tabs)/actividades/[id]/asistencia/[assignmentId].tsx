import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { FilterChips } from '@/components/filter-chips';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { TimeField } from '@/components/time-field';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  correctAttendance, getActivity, recordAttendance,
  type ActivityDetail, type AttendanceStatus, type Participant,
} from '@/services/activities';
import {
  attendancePayload, attendanceStatusLabels, draftFromRecord, hoursText, maxHours, serverFieldToAttendance, validateAttendance,
  type AttendanceDraft, type AttendanceErrors, type AttendanceField,
} from '@/utils/attendance-rules';
import { formatSchedule, mexicoParts } from '@/utils/time';

const statusOptions = (Object.keys(attendanceStatusLabels) as AttendanceStatus[])
  .map((value) => ({ value, label: attendanceStatusLabels[value] }));

// Records one person's attendance, or, once the activity is finalized, lets an admin correct it with a reason.
export default function AttendanceFormScreen() {
  const router = useRouter();
  const { id, assignmentId } = useLocalSearchParams<{ id: string; assignmentId: string }>();
  const { user, refresh } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [draft, setDraft] = useState<AttendanceDraft | null>(null);
  const [errors, setErrors] = useState<AttendanceErrors>({});
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const found = await getActivity(id);
      const entry = found.participants.find((item) => item.assignmentId === assignmentId && item.status === 'assigned') ?? null;
      setDetail(found);
      setParticipant(entry);
      setDraft(entry ? draftFromRecord(entry.attendance, found.activity) : null);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setLoadError(apiMessage(cause));
    }
  }, [id, assignmentId, refresh]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;
  const activity = detail?.activity;
  const correcting = Boolean(activity?.attendanceFinalizedAt);
  const allowed = activity
    ? correcting ? roleCan.correctAttendance(user.role) : roleCan.recordAttendance(user.role, activity.supervisorId, user.id)
    : false;
  const name = participant ? `${participant.firstName} ${participant.lastName}` : undefined;

  function set(field: AttendanceField) {
    return (value: string) => {
      setDraft((current) => (current ? { ...current, [field]: value } : current));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
      setMessage('');
    };
  }

  async function submit() {
    if (pending.current || !draft || !activity || !participant) return;
    const invalid = validateAttendance(draft, activity, correcting);
    setErrors(invalid);
    if (Object.keys(invalid).length) { setMessage('Revisa los campos marcados.'); return; }
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const payload = attendancePayload(draft, activity);
      if (correcting) await correctAttendance(activity.id, participant.assignmentId, { ...payload, reason: draft.reason.trim() });
      else await recordAttendance(activity.id, participant.assignmentId, payload);
      router.back();
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      if (cause instanceof ApiError) {
        const fromServer: AttendanceErrors = {};
        for (const [key, text] of Object.entries(cause.fields)) {
          const field = serverFieldToAttendance[key];
          if (field) fromServer[field] = text;
        }
        setErrors(fromServer);
      }
      setMessage(apiMessage(cause, 'No pudimos guardar la asistencia. Inténtalo de nuevo.'));
    } finally { pending.current = false; setBusy(false); }
  }

  let body;
  if (loadError) {
    body = (
      <View style={styles.block}>
        <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir la asistencia" body={loadError} />
        <Button label="Reintentar" variant="secondary" onPress={() => void load()} />
      </View>
    );
  } else if (!detail || !activity) {
    body = <ActivityIndicator color={Brand.primary} />;
  } else if (!participant || !draft) {
    body = <EmptyState icon={{ ios: 'person.crop.circle.badge.xmark', android: 'person_off' }} title="Esta persona ya no está asignada"
      body="Solo se registra la asistencia de personas asignadas. Regresa a la actividad para ver la lista actual." />;
  } else if (!allowed) {
    body = <EmptyState icon={{ ios: 'lock', android: 'lock' }} title="No puedes cambiar esta asistencia"
      body={correcting ? 'La asistencia ya está finalizada. Solo Administración puede corregirla.'
        : 'Solo el supervisor de esta actividad, Coordinación o Administración registran su asistencia.'} />;
  } else {
    const absent = draft.status === 'absent';
    const limit = maxHours(draft, activity);
    const startTime = mexicoParts(activity.startsAt).time;
    body = (
      <View style={styles.form}>
        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>¿Cómo asistió?</Text>
          <FilterChips testID="attendance-status" options={statusOptions} value={draft.status} onChange={set('status')} />
          {errors.status ? <Text accessibilityRole="alert" style={styles.fieldError}>{errors.status}</Text> : null}
        </View>

        {draft.status && !absent ? (
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>Horario y horas</Text>
            <Card>
              <View style={styles.groupBody}>
                <TimeField testID="attendance-check-in" label="Entrada (opcional)" value={draft.checkIn} onChange={set('checkIn')}
                  error={errors.checkIn} start={startTime} />
                <TimeField testID="attendance-check-out" label="Salida (opcional)" value={draft.checkOut} onChange={set('checkOut')}
                  error={errors.checkOut} start={mexicoParts(activity.endsAt).time} />
                <FormField testID="attendance-hours" label="Horas" value={draft.hours} onChangeText={set('hours')} error={errors.hours}
                  placeholder={hoursText(limit)} keyboardType="decimal-pad" maxLength={5} editable={!busy}
                  hint={`Vacío se calcula solo: ${hoursText(limit)} h. Máximo: ${hoursText(limit)} h.`} />
                <Text style={styles.hint}>Hora de Guadalajara, dentro de {formatSchedule(activity.startsAt, activity.endsAt)}</Text>
              </View>
            </Card>
          </View>
        ) : absent ? <Text style={styles.hint}>Una falta cuenta 0 horas y no lleva horario.</Text> : null}

        {correcting ? (
          <FormField testID="attendance-reason" label="Motivo de la corrección" value={draft.reason} onChangeText={set('reason')}
            error={errors.reason} hint="Queda guardado con el registro y en el historial de cambios." multiline maxLength={500}
            style={styles.multiline} textAlignVertical="top" editable={!busy} />
        ) : null}

        {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}
        <Button testID="attendance-submit" label={correcting ? 'Guardar corrección' : 'Guardar'} busyLabel="Guardando…" busy={busy}
          onPress={() => void submit()} />
      </View>
    );
  }

  return (
    <Screen testID="attendance-form-screen" title={correcting ? 'Corregir asistencia' : 'Asistencia'}
      subtitle={name} onBack={() => router.back()}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 16 },
  form: { gap: 24 },
  group: { gap: 8 },
  groupTitle: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary, paddingHorizontal: 4 },
  groupBody: { gap: 16 },
  hint: { fontFamily: AppFonts.body, color: Brand.textSecondary, fontSize: 13, paddingHorizontal: 4 },
  fieldError: { fontFamily: AppFonts.body, color: Brand.dangerText, fontSize: 13, paddingHorizontal: 4 },
  multiline: { minHeight: 100, paddingTop: 14 },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
