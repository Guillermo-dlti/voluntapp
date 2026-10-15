import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { FieldGroup, FormField } from '@/components/form-field';
import { Row, Section } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { TimeField } from '@/components/time-field';
import { SkeletonRow } from '@/components/skeleton';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
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
      <FieldGroup title="Actividad">
        <FormField testID="activity-name" label="Nombre" value={draft.name} onChangeText={set('name')} error={errors.name}
          placeholder="Ej.: Clasificación de despensas" maxLength={120} autoCapitalize="sentences" returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.location.current?.focus()} {...common} />
        <FormField ref={refs.location} testID="activity-location" label="Lugar" value={draft.location} onChangeText={set('location')}
          error={errors.location} placeholder="Ej.: Bodega principal, Zapopan" maxLength={200} returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.capacity.current?.focus()} {...common} />
        <FormField ref={refs.capacity} testID="activity-capacity" label="Cupo" value={draft.capacity} onChangeText={set('capacity')}
          error={errors.capacity} placeholder="Ej.: 12" hint="Cuántas personas se pueden asignar, de 1 a 1000." keyboardType="number-pad"
          maxLength={4} {...common} />
      </FieldGroup>

      <Section title="Horario" inset="none"
        footer={endsNextDay(draft) ? 'Termina al día siguiente, a la hora de fin.' : 'Hora de Guadalajara. Si el fin es antes del inicio, termina al día siguiente.'}>
        <DateField variant="row" testID="activity-date" label="Fecha" value={draft.date} onChange={set('date')} error={errors.date}
          min={range.min} max={range.max} start={range.start} />
        <TimeField variant="row" testID="activity-start" label="Inicio" value={draft.startTime} onChange={set('startTime')}
          error={errors.startTime} start="09:00" />
        <TimeField variant="row" testID="activity-end" label="Fin" value={draft.endTime} onChange={set('endTime')}
          error={errors.endTime} start="13:00" />
      </Section>

      <View style={styles.group}>
        <Section title="Supervisión" bare={supervisors === null || Boolean(supervisorsError)}>
          {supervisors === null && !supervisorsError ? (
            <Card padded={false}>
              <View accessible accessibilityLabel="Cargando supervisores…"><SkeletonRow leading="icon" /><SkeletonRow leading="icon" /></View>
            </Card>
          ) : supervisorsError ? (
            <Card><Text style={styles.hint}>{supervisorsError}</Text></Card>
          ) : [{ id: '', fullName: 'Sin supervisor' }, ...(supervisors ?? [])].map((staff) => (
            <Row key={staff.id || 'none'} testID={`activity-supervisor-${staff.id || 'none'}`} label={staff.fullName} chevron={false}
              trailing={draft.supervisorId === staff.id
                ? <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} color={Brand.primary} />
                : <Icon name={{ ios: 'circle', android: 'radio_button_unchecked' }} size={22} color={Brand.textTertiary} />}
              onPress={busy ? undefined : () => set('supervisorId')(staff.id)} />
          ))}
        </Section>
        {/* The saved supervisor may have been deactivated since; keep showing the choice so it isn't lost silently. */}
        {draft.supervisorId && supervisors && !selectedSupervisor ? (
          <Text style={styles.note}>La persona elegida ya no está activa. Elige a otra o “Sin supervisor”.</Text>
        ) : null}
        {errors.supervisorId ? <Text accessibilityRole="alert" style={styles.fieldError}>{errors.supervisorId}</Text> : null}
      </View>

      <FieldGroup title="Detalles">
        <FormField testID="activity-description" label="Descripción (opcional)" value={draft.description} onChangeText={set('description')}
          error={errors.description} hint="Qué se va a hacer." multiline maxLength={2000} style={styles.multiline} textAlignVertical="top" {...common} />
        <FormField testID="activity-requirements" label="Requisitos (opcional)" value={draft.requirements} onChangeText={set('requirements')}
          error={errors.requirements} hint="Ropa, calzado, edad mínima o lo que deban traer." multiline maxLength={1000}
          style={styles.multiline} textAlignVertical="top" {...common} />
      </FieldGroup>

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

const styles = StyleSheet.create({
  form: { gap: Spacing.xl },
  group: { gap: Spacing.sm },
  hint: { ...Type.footnote, color: Brand.textSecondary },
  note: { ...Type.footnote, color: Brand.textSecondary, paddingHorizontal: Spacing.xs },
  multiline: { minHeight: 100, paddingTop: 14 },
  fieldError: { ...Type.footnote, color: Brand.dangerText, paddingHorizontal: Spacing.xs },
  alert: { gap: Spacing.xs, backgroundColor: Brand.dangerLight, borderRadius: Radius.tile, paddingVertical: Spacing.md, paddingHorizontal: 14 },
  alertText: { ...Type.callout, color: Brand.dangerText },
});
