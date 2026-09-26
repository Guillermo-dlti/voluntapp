import { ApiError, apiRequest } from '@/services/api';
import type { activityPayload } from '@/utils/activity-rules';

export type ActivityStatus = 'draft' | 'open' | 'closed' | 'cancelled';
export type WhenFilter = 'upcoming' | 'past' | 'cancelled' | 'all';

export interface ActivitySummary {
  id: string;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  assignedCount: number;
  status: ActivityStatus;
}

export interface Activity extends ActivitySummary {
  description: string | null;
  requirements: string | null;
  supervisorId: string | null;
  attendanceFinalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface AttendanceRecord {
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hours: number;
  finalized: boolean;
  correctionReason: string | null;
}

export interface Participant {
  assignmentId: string;
  volunteerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: 'assigned' | 'cancelled';
  cancelledReason: string | null;
  attendance: AttendanceRecord | null;
}

export interface MissingPerson {
  assignmentId: string;
  firstName: string;
  lastName: string;
}

export interface ActivityDetail {
  activity: Activity;
  supervisor: { id: string; fullName: string } | null;
  participants: Participant[];
}

export interface DateConflict {
  volunteerId: string;
  volunteerName: string;
  activityId: string;
  activityName: string;
}

type Payload = ReturnType<typeof activityPayload>;

const malformed = () => new ApiError('Recibimos una respuesta inesperada del servidor. Inténtalo de nuevo.');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
const str = (value: unknown): value is string => typeof value === 'string';
const strOrNull = (value: unknown) => value === null || str(value);
const num = (value: unknown): value is number => typeof value === 'number';
const statuses: readonly unknown[] = ['draft', 'open', 'closed', 'cancelled'];

function isSummary(value: unknown): value is ActivitySummary {
  return isRecord(value) && str(value.id) && str(value.name) && str(value.location) && str(value.startsAt) && str(value.endsAt)
    && num(value.capacity) && num(value.assignedCount) && statuses.includes(value.status);
}

function isActivity(value: unknown): value is Activity {
  return isSummary(value) && isRecord(value) && strOrNull(value.description) && strOrNull(value.requirements)
    && strOrNull(value.supervisorId) && strOrNull(value.attendanceFinalizedAt) && str(value.createdAt) && str(value.updatedAt);
}

const attendanceStatuses: readonly unknown[] = ['present', 'late', 'absent'];

function isAttendance(value: unknown): value is AttendanceRecord {
  return isRecord(value) && attendanceStatuses.includes(value.status) && strOrNull(value.checkInAt) && strOrNull(value.checkOutAt)
    && num(value.hours) && typeof value.finalized === 'boolean' && strOrNull(value.correctionReason);
}

function isParticipant(value: unknown): value is Participant {
  return isRecord(value) && str(value.assignmentId) && str(value.volunteerId) && str(value.firstName) && str(value.lastName)
    && str(value.phone) && (value.status === 'assigned' || value.status === 'cancelled') && strOrNull(value.cancelledReason)
    && (value.attendance === null || isAttendance(value.attendance));
}

function activityFrom(result: unknown): Activity {
  if (!isRecord(result) || !isActivity(result.activity)) throw malformed();
  return result.activity;
}

const path = (id: string) => `/api/activities/${encodeURIComponent(id)}`;

export async function listActivities(params: { q: string; when: WhenFilter; page: number }) {
  const query = new URLSearchParams({ when: params.when, page: String(params.page), ...(params.q.trim() ? { q: params.q.trim() } : {}) });
  const result = await apiRequest(`/api/activities?${query.toString()}`);
  if (!isRecord(result) || !Array.isArray(result.activities) || typeof result.hasMore !== 'boolean') throw malformed();
  const activities = result.activities.filter(isSummary);
  if (activities.length !== result.activities.length) throw malformed();
  return { activities, hasMore: result.hasMore };
}

export async function getActivity(id: string): Promise<ActivityDetail> {
  const result = await apiRequest(path(id));
  if (!isRecord(result) || !Array.isArray(result.participants)) throw malformed();
  const supervisor = result.supervisor;
  if (supervisor !== null && !(isRecord(supervisor) && str(supervisor.id) && str(supervisor.fullName))) throw malformed();
  const participants = result.participants.filter(isParticipant);
  if (participants.length !== result.participants.length) throw malformed();
  return {
    activity: activityFrom(result),
    supervisor: supervisor === null ? null : { id: String(supervisor.id), fullName: String(supervisor.fullName) },
    participants,
  };
}

export async function createActivity(payload: Payload): Promise<Activity> {
  // On create an empty optional field is simply left out.
  const body = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ''));
  return activityFrom(await apiRequest('/api/activities', { method: 'POST', body }));
}

export async function updateActivity(id: string, payload: Payload): Promise<Activity> {
  return activityFrom(await apiRequest(path(id), { method: 'PATCH', body: payload }));
}

export async function setActivityStatus(id: string, status: ActivityStatus): Promise<Activity> {
  return activityFrom(await apiRequest(`${path(id)}/status`, { method: 'POST', body: { status } }));
}

export async function assignVolunteer(activityId: string, volunteerId: string): Promise<void> {
  await apiRequest(`${path(activityId)}/assignments`, { method: 'POST', body: { volunteerId } });
}

export async function cancelAssignment(activityId: string, assignmentId: string, reason: string): Promise<void> {
  await apiRequest(`${path(activityId)}/assignments/${encodeURIComponent(assignmentId)}/cancel`, { method: 'POST', body: { reason } });
}

export interface AttendancePayload {
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  hours?: number;
}

const attendancePath = (activityId: string, assignmentId: string) =>
  `${path(activityId)}/attendance/${encodeURIComponent(assignmentId)}`;

export async function recordAttendance(activityId: string, assignmentId: string, payload: AttendancePayload): Promise<void> {
  await apiRequest(attendancePath(activityId, assignmentId), { method: 'PUT', body: payload });
}

export async function correctAttendance(activityId: string, assignmentId: string, payload: AttendancePayload & { reason: string }): Promise<void> {
  await apiRequest(`${attendancePath(activityId, assignmentId)}/correct`, { method: 'POST', body: payload });
}

export async function markAllPresent(activityId: string): Promise<number> {
  const result = await apiRequest(`${path(activityId)}/attendance/mark-all-present`, { method: 'POST' });
  if (!isRecord(result) || !num(result.created)) throw malformed();
  return result.created;
}

export async function finalizeAttendance(activityId: string): Promise<Activity> {
  return activityFrom(await apiRequest(`${path(activityId)}/attendance/finalize`, { method: 'POST' }));
}

// The people without a record, from a 409 on finalize.
export function missingPeople(error: unknown): MissingPerson[] {
  if (!(error instanceof ApiError) || !isRecord(error.body) || !Array.isArray(error.body.missing)) return [];
  return error.body.missing.filter((entry): entry is MissingPerson =>
    isRecord(entry) && str(entry.assignmentId) && str(entry.firstName) && str(entry.lastName));
}

export async function listSupervisors(): Promise<{ id: string; fullName: string }[]> {
  const result = await apiRequest('/api/staff/supervisors');
  if (!isRecord(result) || !Array.isArray(result.supervisors)) throw malformed();
  return result.supervisors.filter((entry): entry is { id: string; fullName: string } => isRecord(entry) && str(entry.id) && str(entry.fullName));
}

// The people a date change would double book, from a 409 on edit.
export function dateConflicts(error: unknown): DateConflict[] {
  if (!(error instanceof ApiError) || !isRecord(error.body) || !Array.isArray(error.body.conflicts)) return [];
  return error.body.conflicts.filter((entry): entry is DateConflict =>
    isRecord(entry) && str(entry.volunteerId) && str(entry.volunteerName) && str(entry.activityId) && str(entry.activityName));
}
