// Where an activity is in its life and what staff should do next. The detail screen, the list, and
// the dashboard all read it from here so they never disagree. It only decides what to show: every
// action still goes through its endpoint, which checks the role and state again.
import { roleCan } from '@/constants/roles';
import type { ActivityDetail, ActivitySummary, Participant } from '@/services/activities';
import type { StaffRole } from '@/services/auth';
import { hoursText } from '@/utils/attendance-rules';
import { formatDateTime } from '@/utils/time';

export type ActivityStep = 'draft' | 'published' | 'attendance' | 'finalized' | 'cancelled';
export type DetailTab = 'detalles' | 'participantes' | 'asistencia';
export type NextAction = 'publish' | 'assign' | 'take-attendance' | 'finalize';

type Timing = Pick<ActivitySummary, 'status' | 'startsAt' | 'attendanceFinalizedAt'>;

// The four steps of the progress strip, in order. Cancelled is a card, not a step.
export const flowSteps: readonly { step: Exclude<ActivityStep, 'cancelled'>; label: string }[] = [
  { step: 'draft', label: 'Borrador' },
  { step: 'published', label: 'Publicada' },
  { step: 'attendance', label: 'Asistencia' },
  { step: 'finalized', label: 'Finalizada' },
];

// The device clock only picks what to show; a phone set a few minutes off shows a step early or
// late, and the API still refuses anything the real state doesn't allow.
export function activityStep(activity: Timing, now = new Date()): ActivityStep {
  if (activity.status === 'cancelled') return 'cancelled';
  if (activity.attendanceFinalizedAt) return 'finalized';
  if (activity.status === 'draft') return 'draft';
  return new Date(activity.startsAt) > now ? 'published' : 'attendance';
}

export function defaultTab(step: ActivityStep): DetailTab {
  if (step === 'published') return 'participantes';
  if (step === 'attendance' || step === 'finalized') return 'asistencia';
  return 'detalles';
}

export function isDetailTab(value: unknown): value is DetailTab {
  return value === 'detalles' || value === 'participantes' || value === 'asistencia';
}

// Assigned people and how many of them already have an attendance record.
export function rollCall(participants: Participant[]) {
  const assigned = participants.filter((entry) => entry.status === 'assigned');
  const recorded = assigned.filter((entry) => entry.attendance !== null).length;
  return { assigned, recorded, missing: assigned.length - recorded };
}

// Hours that count once attendance is finalized: the sum over the people still assigned.
export function countedHours(participants: Participant[]): number {
  const total = rollCall(participants).assigned.reduce((sum, entry) => sum + (entry.attendance?.hours ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export interface Viewer { role: StaffRole; id: string }

// Whether this person may take or change attendance now (before it is finalized).
export function canRecordOn(detail: ActivityDetail, viewer: Viewer): boolean {
  const { activity } = detail;
  return activity.attendanceFinalizedAt === null && activity.status !== 'draft' && activity.status !== 'cancelled'
    && roleCan.recordAttendance(viewer.role, activity.supervisorId, viewer.id);
}

export interface NextStep {
  text: string;
  // Absent when there's nothing to do, or the role may not do it; the card then shows only the text.
  action?: { kind: NextAction; label: string };
}

export function nextStep(detail: ActivityDetail, viewer: Viewer, now = new Date()): NextStep {
  const { activity, participants } = detail;
  const step = activityStep(activity, now);
  const canEdit = roleCan.editActivities(viewer.role);
  const canAssign = roleCan.assignVolunteers(viewer.role);
  const canRecord = canRecordOn(detail, viewer);
  // The time already ends in "a.m."/"p.m.", so no second period.
  const starts = `Empieza el ${formatDateTime(activity.startsAt).replace(/\.$/, '')}.`;

  if (step === 'cancelled') return { text: 'Actividad cancelada. Sus asignaciones se conservan.' };
  if (step === 'finalized') return { text: `Asistencia finalizada. ${hoursText(countedHours(participants))} h contadas.` };
  if (step === 'draft') {
    return {
      text: 'Publica la actividad para poder asignar voluntarios.',
      ...(canEdit ? { action: { kind: 'publish', label: 'Publicar' } } : {}),
    };
  }
  if (step === 'published') {
    if (activity.status === 'closed') return { text: `${starts} Inscripciones cerradas.` };
    if (activity.assignedCount >= activity.capacity) return { text: `${starts} Cupo lleno.` };
    return {
      text: `${starts} Asignados ${activity.assignedCount} de ${activity.capacity}.`,
      ...(canAssign ? { action: { kind: 'assign', label: 'Asignar voluntarios' } } : {}),
    };
  }
  const { assigned, recorded } = rollCall(participants);
  if (assigned.length === 0) {
    // The "⋯" hint only helps someone who has that menu and something left in it to do.
    return {
      text: canEdit && activity.status === 'open'
        ? 'Nadie quedó asignado. Puedes cerrar las inscripciones desde ⋯.'
        : 'Nadie quedó asignado, así que no hay asistencia que tomar.',
    };
  }
  if (recorded < assigned.length) {
    return {
      text: `Toma la asistencia: ${recorded} de ${assigned.length} registrados.`,
      ...(canRecord ? { action: { kind: 'take-attendance', label: 'Tomar asistencia' } } : {}),
    };
  }
  return {
    text: 'Todos registrados. Finaliza para que las horas cuenten.',
    ...(canRecord ? { action: { kind: 'finalize', label: 'Finalizar asistencia' } } : {}),
  };
}

export type HintTone = 'neutral' | 'full' | 'attention';

// One line under each row of the Actividades list saying what the activity needs next.
export function listHint(activity: ActivitySummary, now = new Date()): { text: string; tone: HintTone } | null {
  const step = activityStep(activity, now);
  if (step === 'cancelled') return null;
  if (step === 'draft') return { text: 'Borrador: falta publicar', tone: 'neutral' };
  if (step === 'finalized') return { text: 'Asistencia finalizada', tone: 'neutral' };
  if (step === 'attendance') return { text: 'Asistencia por finalizar', tone: 'attention' };
  if (activity.status !== 'open') return null;
  const free = activity.capacity - activity.assignedCount;
  if (free <= 0) return { text: 'Cupo lleno', tone: 'full' };
  return { text: free === 1 ? 'Falta 1 lugar' : `Faltan ${free} lugares`, tone: 'neutral' };
}
