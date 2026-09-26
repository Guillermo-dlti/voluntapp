import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { Row } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { TimeField } from '@/components/time-field';
import { AppFonts, Brand } from '@/constants/theme';
import { ApiError, apiMessage } from '@/services/api';
import { dateConflicts, listSupervisors, type DateConflict } from '@/services/activities';
import {
  activityDateRange, endsNextDay, serverFieldToDraft, validateActivity,
  type ActivityDraft, type ActivityErrors, type ActivityField,
} from '@/utils/activity-rules';

interface ActivityFormProps {
  initial: ActivityDraft;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (draft: ActivityDraft) => Promise<void>;
  // A 401 during save: the session is gone, so the app signs out.
  onSessionEnded: () => void;
}

// Shared by "Nueva actividad" and "Editar actividad": same fields, same checks, same messages.
export function ActivityForm({ initial, submitLabel, busyLabel, onSubmit, onSessionEnded }: ActivityFormProps) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<ActivityErrors>({});
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<DateConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [supervisors, setSupervisors] = useState<{ id: string; fullName: string }[] | null>(null);
  const [supervisorsError, setSupervisorsError] = useState('');
  const refs = { location: useRef<TextInput>(null), capacity: useRef<TextInput>(null) };
  // Screens pass this inline, so it's read through a ref to load the supervisors only once.
  const sessionEnded = useRef(onSessionEnded);
  sessionEnded.current = onSessionEnded;

  useEffect(() => {
    let active = true;
    listSupervisors()
      .then((list) => { if (active) setSupervisors(list); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) { sessionEnded.current(); return; }
        setSupervisorsError(apiMessage(cause, 'No pudimos cargar la lista de supervisores.'));
      });
    return () => { active = false; };
  }, []);

  function set(field: ActivityField) {
    return (value: string) => {
      setDraft((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
      setMessage('');
      setConflicts([]);
    };
  }

  async function submit() {
    if (pending.current) return;
    const invalid = validateActivity(draft);
    setErrors(invalid);
    setConflicts([]);
    if (Object.keys(invalid).length) { setMessage('Revisa los campos marcados.'); return; }
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await onSubmit(draft);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionEnded(); return; }
      if (cause instanceof ApiError) {
        const fromServer: ActivityErrors = {};
        for (const [key, text] of Object.entries(cause.fields)) {
          const field = serverFieldToDraft[key];
          if (field) fromServer[field] = text;
        }
        setErrors(fromServer);
        setConflicts(dateConflicts(cause));
        setMessage(cause.message);
      } else {
        setMessage('No pudimos guardar los cambios. Inténtalo de nuevo.');
      }
    } finally { pending.current = false; setBusy(false); }
  }

  const range = activityDateRange();
  const common = { editable: !busy } as const;
  const selectedSupervisor = supervisors?.find((staff) => staff.id === draft.supervisorId);

  return (
    <View style={styles.form}>
      <FormGroup title="Actividad">
        <FormField testID="activity-name" label="Nombre" value={draft.name} onChangeText={set('name')} error={errors.name}
          placeholder="Clasificación de despensas" maxLength={120} autoCapitalize="sentences" returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.location.current?.focus()} {...common} />
        <FormField ref={refs.location} testID="activity-location" label="Lugar" value={draft.location} onChangeText={set('location')}
          error={errors.location} placeholder="Bodega principal, Zapopan" maxLength={200} returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.capacity.current?.focus()} {...common} />
        <FormField ref={refs.capacity} testID="activity-capacity" label="Cupo" value={draft.capacity} onChangeText={set('capacity')}
          error={errors.capacity} hint="Cuántas personas se pueden asignar, de 1 a 1000." keyboardType="number-pad" maxLength={4} {...common} />
      </FormGroup>

      <FormGroup title="Horario">
        <DateField testID="activity-date" label="Fecha" value={draft.date} onChange={set('date')} error={errors.date}
          min={range.min} max={range.max} start={range.start} />
        <TimeField testID="activity-start" label="Inicio" value={draft.startTime} onChange={set('startTime')}
          error={errors.startTime} start="09:00" />
        <TimeField testID="activity-end" label="Fin" value={draft.endTime} onChange={set('endTime')}
          error={errors.endTime} start="13:00" />
        <Text style={styles.hint}>
          {endsNextDay(draft) ? 'Termina al día siguiente, a la hora de fin.' : 'Hora de Guadalajara. Si el fin es antes del inicio, termina al día siguiente.'}
        </Text>
      </FormGroup>

      <FormGroup title="Supervisión" padded={false}>
        {supervisors === null && !supervisorsError ? (
          <View style={styles.loading}><ActivityIndicator color={Brand.primary} /></View>
        ) : supervisorsError ? (
          <Text style={[styles.hint, styles.padded]}>{supervisorsError}</Text>
        ) : (
          <View>
            {[{ id: '', fullName: 'Sin supervisor' }, ...(supervisors ?? [])].map((staff, index) => (
              <View key={staff.id || 'none'}>
                {index > 0 ? <View style={styles.hairline} /> : null}
                <Row testID={`activity-supervisor-${staff.id || 'none'}`} label={staff.fullName} chevron={false}
                  trailing={draft.supervisorId === staff.id
                    ? <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} color={Brand.primary} />
                    : <Icon name={{ ios: 'circle', android: 'radio_button_unchecked' }} size={22} color={Brand.textTertiary} />}
                  onPress={busy ? undefined : () => set('supervisorId')(staff.id)} />
              </View>
            ))}
            {/* The saved supervisor may have been deactivated since; keep showing the choice so it isn't lost silently. */}
            {draft.supervisorId && supervisors && !selectedSupervisor ? (
              <Text style={[styles.hint, styles.padded]}>La persona elegida ya no está activa. Elige a otra o “Sin supervisor”.</Text>
            ) : null}
          </View>
        )}
      </FormGroup>
      {errors.supervisorId ? <Text accessibilityRole="alert" style={styles.fieldError}>{errors.supervisorId}</Text> : null}

      <FormGroup title="Detalles">
        <FormField testID="activity-description" label="Descripción (opcional)" value={draft.description} onChangeText={set('description')}
          error={errors.description} hint="Qué se va a hacer." multiline maxLength={2000} style={styles.multiline} textAlignVertical="top" {...common} />
        <FormField testID="activity-requirements" label="Requisitos (opcional)" value={draft.requirements} onChangeText={set('requirements')}
          error={errors.requirements} hint="Ropa, calzado, edad mínima o lo que deban traer." multiline maxLength={1000}
          style={styles.multiline} textAlignVertical="top" {...common} />
      </FormGroup>

      {message ? (
        <View accessibilityRole="alert" style={styles.alert}>
          <Text style={styles.alertText}>{message}</Text>
          {conflicts.map((entry) => (
            <Text key={`${entry.volunteerId}-${entry.activityId}`} style={styles.alertText}>
              · {entry.volunteerName}, en «{entry.activityName}»
            </Text>
          ))}
        </View>
      ) : null}
      <Button testID="activity-submit" label={submitLabel} busyLabel={busyLabel} busy={busy} onPress={() => void submit()} />
    </View>
  );
}

function FormGroup({ title, padded = true, children }: { title: string; padded?: boolean; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      <Card padded={padded}><View style={padded ? styles.groupBody : undefined}>{children}</View></Card>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  group: { gap: 8 },
  groupTitle: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary, paddingHorizontal: 4 },
  groupBody: { gap: 16 },
  hint: { fontFamily: AppFonts.body, color: Brand.textSecondary, fontSize: 13 },
  padded: { padding: 16 },
  loading: { padding: 16, alignItems: 'center' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.divider, marginLeft: 16 },
  multiline: { minHeight: 100, paddingTop: 14 },
  fieldError: { fontFamily: AppFonts.body, color: Brand.dangerText, fontSize: 13, marginTop: -16, paddingHorizontal: 4 },
  alert: { gap: 4, backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
