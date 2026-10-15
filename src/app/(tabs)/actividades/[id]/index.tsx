import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { ActivityStepBadge } from '@/components/activity-status';
import { NextStepCard, ProgressStrip } from '@/components/activity-progress';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FilterChips } from '@/components/filter-chips';
import { Row, Section } from '@/components/grouped-list';
import { IconButton } from '@/components/icon-button';
import { ReasonDialog } from '@/components/reason-dialog';
import { ProgressBar } from '@/components/progress-bar';
import { RollCallRow } from '@/components/roll-call-row';
import { Screen } from '@/components/screen';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { SkeletonActivityDetail } from '@/components/skeleton';
import { roleCan } from '@/constants/roles';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useFeedback } from '@/providers/feedback-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  cancelAssignment, finalizeAttendance, getActivity, markAllPresent, missingPeople, recordAttendance, setActivityStatus, startAttendance,
  type ActivityDetail, type ActivityStatus, type AttendanceStatus, type MissingPerson, type Participant,
} from '@/services/activities';
import {
  activityStep, canRecordOn, countedHours, defaultTab, isDetailTab, nextStep, rollCall, type DetailTab, type NextAction,
} from '@/utils/activity-flow';
import { hoursText } from '@/utils/attendance-rules';
import { formatDateTime, formatSchedule } from '@/utils/time';
import { formatPhone } from '@/utils/volunteer-rules';

const tabOptions = [
  { value: 'detalles', label: 'Detalles' },
  { value: 'participantes', label: 'Participantes' },
  { value: 'asistencia', label: 'Asistencia' },
] as const;

type Busy = ActivityStatus | 'start' | 'mark-all' | 'finalize' | null;

const statusToasts: Record<ActivityStatus, string> = {
  open: 'Actividad publicada.',
  closed: 'Inscripciones cerradas.',
  cancelled: 'Actividad cancelada.',
  draft: 'La actividad volvió a borrador.',
};

// A start time inside a sentence: the formatted time already ends in "a.m."/"p.m.", so the sentence's
// own period would double it.
const startsText = (iso: string) => formatDateTime(iso).replace(/\.$/, '');

export default function ActivityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = params.id;
  const { user, refresh } = useAuth();
  const feedback = useFeedback();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  // A `tab` in the route wins; otherwise it's picked from the state on the first load and then kept,
  // so coming back from Editar, Asignar or the attendance form lands on the same tab.
  const [tab, setTab] = useState<DetailTab | null>(isDetailTab(params.tab) ? params.tab : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Participant | null>(null);
  const [cancelling, setCancelling] = useState<Participant | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [missing, setMissing] = useState<MissingPerson[]>([]);
  const [rollFilter, setRollFilter] = useState<'all' | 'unrecorded'>('all');
  const [saving, setSaving] = useState<Record<string, true>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const pending = useRef(false);
  const savingRows = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const found = await getActivity(id);
      setDetail(found);
      setTab((current) => current ?? defaultTab(activityStep(found.activity)));
      setMessage('');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  // Reload on focus, so returning from "Editar", "Asignar" or the attendance form shows the new state.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function changeStatus(next: ActivityStatus) {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy(next);
    try {
      const activity = await setActivityStatus(detail.activity.id, next);
      setDetail((current) => (current ? { ...current, activity } : current));
      setMessage('');
      feedback.toast(statusToasts[next]);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause, 'No pudimos cambiar el estado. Inténtalo de nuevo.'));
      void load();
    } finally { pending.current = false; setBusy(null); }
  }

  async function startEarly() {
    if (pending.current || !detail) return;
    pending.current = true;
    setBusy('start');
    setMessage('');
    try {
      const activity = await startAttendance(detail.activity.id);
      setDetail((current) => (current ? { ...current, activity } : current));
      setTab('asistencia');
      feedback.toast('Asistencia iniciada. Ya puedes marcar quién llegó.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause, 'No pudimos iniciar la asistencia. Inténtalo de nuevo.'));
      void load();
    } finally { pending.current = false; setBusy(null); }
  }

  function confirmStart() {
    if (!detail) return;
    Alert.alert('¿Iniciar la asistencia ahora?',
      `La actividad empieza el ${startsText(detail.activity.startsAt)}. Podrás marcar quién llegó desde ya. Las horas de entrada y salida siguen siendo las del horario de la actividad.`,
      [{ text: 'Volver', style: 'cancel' }, { text: 'Iniciar', onPress: () => void startEarly() }]);
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
      feedback.toast('Quedaron todos como presentes.');
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
      // The one celebration in the app: this is the moment the hours become official.
      feedback.celebrate();
      feedback.toast('Asistencia finalizada. Las horas ya cuentan.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setAttendanceMessage(apiMessage(cause, 'No pudimos finalizar la asistencia. Inténtalo de nuevo.'));
      setMissing(missingPeople(cause));
      void load();
    } finally { pending.current = false; setBusy(null); }
  }

  // One tap: sends only the status and shows the row as the server saved it (never ahead of it),
  // because attendance becomes official hours.
  async function quickRecord(entry: Participant, status: Exclude<AttendanceStatus, 'late'>) {
    if (!detail || savingRows.current.has(entry.assignmentId)) return;
    // Tapping the status it already has would reset custom times or hours, so it does nothing.
    if (entry.attendance?.status === status) return;
    const key = entry.assignmentId;
    savingRows.current.add(key);
    setSaving((current) => ({ ...current, [key]: true }));
    setRowErrors(({ [key]: _, ...rest }) => rest);
    try {
      const record = await recordAttendance(detail.activity.id, key, { status });
      setDetail((current) => current ? {
        ...current,
        participants: current.participants.map((item) => (item.assignmentId === key ? { ...item, attendance: record } : item)),
      } : current);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setRowErrors((current) => ({ ...current, [key]: apiMessage(cause, 'No pudimos guardar la asistencia. Inténtalo de nuevo.') }));
    } finally {
      savingRows.current.delete(key);
      setSaving(({ [key]: _, ...rest }) => rest);
    }
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
      feedback.toast('Asignación cancelada.');
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
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir la actividad" body={message}
            action={{ label: 'Reintentar', onPress: () => void load() }} />
        ) : <SkeletonActivityDetail />}
      </Screen>
    );
  }

  const { activity, supervisor, participants } = detail;
  const viewer = { role: user.role, id: user.id };
  const step = activityStep(activity);
  const next = nextStep(detail, viewer);
  const currentTab = tab ?? defaultTab(step);
  const canEdit = roleCan.editActivities(user.role);
  const canAssign = roleCan.assignVolunteers(user.role) && activity.status === 'open';
  const { assigned, recorded, missing: unrecorded } = rollCall(participants);
  const cancelled = participants.filter((entry) => entry.status === 'cancelled');
  const free = activity.capacity - activity.assignedCount;
  const finalized = activity.attendanceFinalizedAt !== null;
  // Recording also needs the activity to have started; before that the API refuses it.
  const canRecord = step === 'attendance' && canRecordOn(detail, viewer);
  const canCorrect = finalized && roleCan.correctAttendance(user.role);
  // A scan records the time it happens, so the scanner only makes sense until the activity ends.
  const canScan = canRecord && new Date(activity.endsAt) > new Date();
  // Before the start time, the same people can open attendance early ("Iniciar asistencia").
  const canStart = step === 'published' && canRecordOn(detail, viewer) && assigned.length > 0;
  const showFinalizeBar = currentTab === 'asistencia' && canRecord && assigned.length > 0;
  // One primary action on screen: on Asistencia the tab itself offers start, record and finalize, so
  // the card keeps only its sentence; and the card's "Asignar voluntarios" replaces the tab's own button.
  const attendanceAction = next.action && ['start-attendance', 'take-attendance', 'finalize'].includes(next.action.kind);
  const cardNext = currentTab === 'asistencia' && attendanceAction ? { text: next.text } : next;
  const cardAssigns = next.action?.kind === 'assign';

  const menuActions: SheetAction[] = [];
  if (canEdit && (activity.status === 'draft' || activity.status === 'open')) {
    menuActions.push({
      testID: 'activity-edit', label: 'Editar datos', icon: { ios: 'pencil', android: 'edit' },
      onPress: () => router.push({ pathname: '/actividades/[id]/editar', params: { id: activity.id } }),
    });
    if (activity.status === 'open' && activity.assignedCount === 0) {
      menuActions.push({
        testID: 'activity-unpublish', label: 'Volver a borrador', icon: { ios: 'arrow.uturn.backward', android: 'undo' },
        onPress: () => confirm('¿Volver a borrador?', 'La actividad deja de estar publicada y no se puede asignar a nadie hasta que la publiques de nuevo.',
          'Volver a borrador', 'draft'),
      });
    }
    if (activity.status === 'open') {
      menuActions.push({
        testID: 'activity-close', label: 'Cerrar inscripciones', icon: { ios: 'checkmark.circle', android: 'task_alt' },
        onPress: () => confirm('¿Cerrar inscripciones?', 'Ya no se podrá editar ni asignar a nadie. La asistencia se puede tomar y finalizar igual.',
          'Cerrar inscripciones', 'closed'),
      });
    }
    menuActions.push({
      testID: 'activity-cancel', label: 'Cancelar actividad', icon: { ios: 'xmark.circle', android: 'event_busy' }, critical: true,
      onPress: () => confirm('¿Cancelar la actividad?', 'No se puede deshacer. Las asignaciones y su historial se conservan, y la actividad deja de ocupar el horario de esas personas.',
        'Cancelar actividad', 'cancelled'),
    });
  }

  function runNext(kind: NextAction) {
    if (kind === 'publish') void changeStatus('open');
    else if (kind === 'assign') router.push({ pathname: '/actividades/[id]/asignar', params: { id: activity.id } });
    else if (kind === 'start-attendance') confirmStart();
    else if (kind === 'take-attendance') setTab('asistencia');
    else confirmFinalize();
  }

  const openForm = (entry: Participant, status?: AttendanceStatus) => router.push({
    pathname: '/actividades/[id]/asistencia/[assignmentId]',
    params: { id: activity.id, assignmentId: entry.assignmentId, ...(status ? { status } : {}) },
  });

  return (
    <Screen testID="activity-detail-screen" title={activity.name} titleTestID="activity-detail-name" onBack={() => router.back()}
      action={menuActions.length ? (
        <IconButton testID="activity-menu" icon={{ ios: 'ellipsis', android: 'more_horiz' }} accessibilityLabel="Más acciones"
          onDark disabled={busy !== null} onPress={() => setMenuOpen(true)} />
      ) : undefined}
      band={<ActivityStepBadge activity={activity} />}
      footer={showFinalizeBar ? (
        <>
          {/* Until everyone is recorded the button waits as a quiet outline, not a washed-out green. */}
          <Button testID="attendance-finalize" label="Finalizar asistencia" busyLabel="Finalizando…" busy={busy === 'finalize'}
            variant={unrecorded > 0 ? 'secondary' : 'primary'}
            disabled={unrecorded > 0 || busy === 'mark-all'} icon={{ ios: 'lock', android: 'lock' }} onPress={confirmFinalize} />
          {unrecorded > 0 ? (
            <Text testID="attendance-finalize-hint" style={styles.barHint}>
              {unrecorded === 1 ? 'Falta registrar a 1 persona para finalizar.' : `Falta registrar a ${unrecorded} personas para finalizar.`}
            </Text>
          ) : null}
        </>
      ) : undefined}>

      {step === 'cancelled' ? null : <ProgressStrip step={step} />}
      <NextStepCard step={step} next={cardNext} busy={busy === 'open' || busy === 'start'}
        busyLabel={busy === 'start' ? 'Iniciando…' : 'Publicando…'}
        onAction={() => { if (next.action) runNext(next.action.kind); }} />

      {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}

      <SegmentedTabs testID="activity-tabs" options={tabOptions} value={currentTab} onChange={setTab} />

      {currentTab === 'detalles' ? detailsTab() : currentTab === 'participantes' ? participantsTab() : attendanceTab()}

      <ActionSheet testID="activity-menu-sheet" visible={menuOpen} title={activity.name} actions={menuActions}
        onClose={() => setMenuOpen(false)} />
      <ActionSheet testID="participant-menu-sheet" visible={menuFor !== null}
        title={menuFor ? `${menuFor.firstName} ${menuFor.lastName}` : ''} subtitle={menuFor ? formatPhone(menuFor.phone) : undefined}
        actions={menuFor ? [{
          testID: 'participant-cancel', label: 'Cancelar asignación', icon: { ios: 'person.badge.minus', android: 'person_remove' },
          critical: true, onPress: () => setCancelling(menuFor),
        }] : []}
        onClose={() => setMenuFor(null)} />
      <ReasonDialog testID="cancel-assignment" visible={cancelling !== null}
        title={cancelling ? `¿Cancelar la asignación de ${cancelling.firstName}?` : ''}
        body="Su registro se conserva con el motivo, y le puedes volver a asignar después."
        confirmLabel="Sí, cancelar" busyLabel="Cancelando…"
        onConfirm={cancelParticipant} onClose={() => setCancelling(null)} />
    </Screen>
  );

  function detailsTab() {
    return (
      <Section inset="icon">
        <Row emphasis="value" icon={{ ios: 'calendar', android: 'event' }} label="Horario" value={formatSchedule(activity.startsAt, activity.endsAt)} />
        <Row emphasis="value" icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }} label="Lugar" value={activity.location} />
        <Row emphasis="value" icon={{ ios: 'person.badge.shield.checkmark', android: 'supervisor_account' }} label="Supervisión"
          value={supervisor?.fullName ?? 'Sin supervisor'} />
        {activity.description ? <Row emphasis="value" icon={{ ios: 'text.alignleft', android: 'notes' }} label="Descripción" value={activity.description} /> : null}
        {activity.requirements ? <Row emphasis="value" icon={{ ios: 'checklist', android: 'checklist' }} label="Requisitos" value={activity.requirements} /> : null}
      </Section>
    );
  }

  function participantsTab() {
    return (
      <>
        <ProgressBar testID="activity-assigned-count" label={`${activity.assignedCount} de ${activity.capacity} asignados`}
          note={free > 0 ? `${free} ${free === 1 ? 'lugar libre' : 'lugares libres'}` : 'Cupo lleno'}
          value={activity.assignedCount} max={activity.capacity} />

        {canAssign && free > 0 && !cardAssigns ? (
          <Button testID="activity-assign" label="Asignar voluntario" icon={{ ios: 'person.badge.plus', android: 'person_add' }}
            onPress={() => router.push({ pathname: '/actividades/[id]/asignar', params: { id: activity.id } })} />
        ) : null}

        <Section title="Asignados" inset="avatar" bare={assigned.length === 0}
          footer={activity.status === 'draft' && canEdit ? 'Publica la actividad para poder asignar voluntarios.'
            : canAssign && free <= 0 ? 'Cupo lleno. Para asignar a alguien más, aumenta el cupo o cancela una asignación.' : undefined}>
          {assigned.length === 0 ? (
            <EmptyState icon={{ ios: 'person.2', android: 'group' }} title="Nadie asignado todavía"
              body={canAssign ? 'Asigna voluntarios activos con el botón “Asignar voluntario”.' : 'Cuando Coordinación asigne voluntarios, aparecerán aquí con su teléfono.'} />
          ) : assigned.map((entry) => {
            const name = `${entry.firstName} ${entry.lastName}`;
            return (
              <Row key={entry.assignmentId} testID={`participant-${entry.volunteerId}`} leading={<Avatar name={name} />}
                label={name} value={formatPhone(entry.phone)}
                trailing={(
                  <View style={styles.rowActions}>
                    <IconButton variant="plain" testID={`participant-${entry.volunteerId}-call`} icon={{ ios: 'phone', android: 'call' }}
                      accessibilityLabel={`Llamar a ${name}`} onPress={() => void Linking.openURL(`tel:${entry.phone}`)} />
                    {canAssign ? (
                      <IconButton variant="plain" testID={`participant-${entry.volunteerId}-menu`} icon={{ ios: 'ellipsis', android: 'more_horiz' }}
                        accessibilityLabel={`Más acciones para ${name}`} onPress={() => setMenuFor(entry)} />
                    ) : null}
                  </View>
                )} />
            );
          })}
        </Section>

        {cancelled.length ? (
          <Section title="Cancelados" inset="avatar">
            {cancelled.map((entry) => (
              <Row key={entry.assignmentId} leading={<Avatar name={`${entry.firstName} ${entry.lastName}`} />}
                label={`${entry.firstName} ${entry.lastName}`} value={entry.cancelledReason ? `Motivo: ${entry.cancelledReason}` : undefined} />
            ))}
          </Section>
        ) : null}
      </>
    );
  }

  function attendanceTab() {
    if (step === 'draft' || step === 'cancelled') {
      return (
        <EmptyState icon={{ ios: 'checklist', android: 'fact_check' }}
          title={step === 'draft' ? 'Todavía no hay asistencia' : 'Sin asistencia'}
          body={step === 'draft' ? 'La asistencia se registra cuando la actividad está publicada y ya empezó.' : 'Una actividad cancelada no lleva asistencia.'} />
      );
    }
    if (step === 'published') {
      return (
        <EmptyState icon={{ ios: 'clock', android: 'schedule' }} title="La asistencia se abre al empezar"
          body={canStart
            ? `Se abre sola el ${startsText(activity.startsAt)}. Si las personas ya llegaron, iníciala ahora.`
            : `Podrás marcar quién asistió a partir del ${startsText(activity.startsAt)}.`}
          action={canStart ? {
            testID: 'attendance-start', label: 'Iniciar asistencia', busyLabel: 'Iniciando…', busy: busy === 'start', variant: 'primary',
            disabled: busy !== null && busy !== 'start', icon: { ios: 'play.circle', android: 'play_circle' }, onPress: confirmStart,
          } : undefined} />
      );
    }
    if (assigned.length === 0) {
      return (
        <EmptyState icon={{ ios: 'checklist', android: 'fact_check' }} title="Nadie a quien tomar asistencia"
          body="La asistencia se registra para las personas asignadas. Sin nadie asignado, no hay horas que contar." />
      );
    }

    // While attendance is open, people who checked in with their QR are already counted, so they leave
    // the roll call (which is for whoever still needs a hand) and wait in their own section.
    const scanned = finalized ? [] : assigned.filter((entry) => entry.attendance?.method === 'qr');
    const roll = finalized ? assigned : assigned.filter((entry) => entry.attendance?.method !== 'qr');
    const shown = rollFilter === 'unrecorded' && !finalized ? roll.filter((entry) => entry.attendance === null) : roll;
    const locked = busy === 'mark-all' || busy === 'finalize';

    return (
      <>
        {finalized && activity.attendanceFinalizedAt ? (
          <View testID="attendance-finalized" style={styles.summary}>
            <Text style={styles.summaryValue}>{hoursText(countedHours(participants))} h contadas</Text>
            <Text style={styles.summaryText}>Asistencia finalizada el {formatDateTime(activity.attendanceFinalizedAt)}.</Text>
            {canCorrect ? <Text style={styles.summaryText}>Toca a una persona para corregir su registro.</Text> : null}
          </View>
        ) : (
          <View style={styles.rollHeader}>
            <ProgressBar testID="attendance-progress" label={`${recorded} de ${assigned.length} registrados`}
              value={recorded} max={assigned.length} tone={unrecorded > 0 ? 'attention' : 'primary'} />
            {/* Counts in the chips, after Luma's check-in tabs ("Going 3 · Checked In 2"). */}
            <FilterChips testID="attendance-filter" value={rollFilter} onChange={setRollFilter} options={[
              { value: 'all', label: `Todos · ${roll.length}` },
              { value: 'unrecorded', label: `Sin registrar · ${unrecorded}` },
            ]} />
            {canScan ? (
              <Button testID="attendance-scan" label="Escanear" variant="secondary" disabled={locked}
                icon={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner' }}
                onPress={() => router.push({ pathname: '/escanear/[id]', params: { id: activity.id } })} />
            ) : null}
          </View>
        )}

        <Section inset="avatar" bare={shown.length === 0} title={scanned.length ? 'Por registrar' : undefined}
          footer={canRecord && shown.length ? 'Presente y Falta se guardan al tocarlos. Tarde, o tocar el nombre, abre el registro con horario y horas.' : undefined}>
          {shown.length === 0 ? (
            <EmptyState icon={{ ios: 'checkmark.circle', android: 'task_alt' }} title="Todos registrados"
              body={scanned.length && roll.length === 0 ? 'Todas las personas llegaron con su QR. Ya puedes finalizar la asistencia.'
                : 'Revisa la lista en “Todos” o finaliza la asistencia.'} />
          ) : shown.map((entry) => (
            <RollCallRow key={entry.assignmentId} entry={entry} recording={canRecord} busy={Boolean(saving[entry.assignmentId])}
              locked={locked} error={rowErrors[entry.assignmentId]}
              onChoose={(status) => {
                if (status === 'late') openForm(entry, 'late');
                else void quickRecord(entry, status);
              }}
              onOpen={canRecord || canCorrect ? () => openForm(entry) : undefined} />
          ))}
        </Section>

        {scanned.length ? (
          <Section title="Llegaron con QR" count={String(scanned.length)} inset="avatar"
            footer={canRecord || canCorrect ? 'Ya cuentan para la asistencia. Toca a una persona para cambiar su horario u horas.' : 'Ya cuentan para la asistencia.'}>
            {scanned.map((entry) => (
              <RollCallRow key={entry.assignmentId} entry={entry} recording={false} busy={false} locked={locked}
                error={rowErrors[entry.assignmentId]} onChoose={() => undefined}
                onOpen={canRecord || canCorrect ? () => openForm(entry) : undefined} />
            ))}
          </Section>
        ) : null}

        {attendanceMessage ? (
          <View accessibilityRole="alert" style={styles.alert}>
            <Text style={styles.alertText}>{attendanceMessage}</Text>
            {missing.map((person) => <Text key={person.assignmentId} style={styles.alertText}>· {person.firstName} {person.lastName}</Text>)}
          </View>
        ) : null}

        {canRecord && unrecorded > 0 ? (
          <Button testID="attendance-mark-all" label="Marcar todos presentes" busyLabel="Marcando…" busy={busy === 'mark-all'}
            disabled={busy === 'finalize'} variant="secondary" icon={{ ios: 'checkmark.circle', android: 'done_all' }}
            onPress={() => void markAll()} />
        ) : null}
      </>
    );
  }
}

const styles = StyleSheet.create({
  rowActions: { flexDirection: 'row' },
  rollHeader: { gap: Spacing.md },
  summary: { gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.card, backgroundColor: Brand.primaryLight },
  summaryValue: { ...Type.title, color: Brand.text },
  summaryText: { ...Type.callout, color: Brand.textSecondary },
  barHint: { ...Type.footnote, color: Brand.textSecondary, textAlign: 'center' },
  alert: { gap: Spacing.xs, backgroundColor: Brand.dangerLight, borderRadius: Radius.tile, paddingVertical: Spacing.md, paddingHorizontal: 14 },
  alertText: { ...Type.callout, color: Brand.dangerText },
});
