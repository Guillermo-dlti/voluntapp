import { ApiError, apiRequest } from '@/services/api';
import type { draftToPayload } from '@/utils/volunteer-rules';

export type VolunteerStatus = 'active' | 'inactive';
export type StatusFilter = VolunteerStatus | 'all';

export interface VolunteerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: VolunteerStatus;
}

export interface Volunteer extends VolunteerSummary {
  birthDate: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  assignmentId: string;
  assignmentStatus: 'assigned' | 'cancelled';
  activity: { id: string; name: string; startsAt: string; endsAt: string; status: string };
  attendance: { status: 'present' | 'absent' | 'late'; hours: number; finalized: boolean } | null;
}

export interface VolunteerDetail {
  volunteer: Volunteer;
  history: HistoryEntry[];
  totalHours: number;
  completedActivities: number;
}

type Payload = ReturnType<typeof draftToPayload>;

const malformed = () => new ApiError('Recibimos una respuesta inesperada del servidor. Inténtalo de nuevo.');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
const str = (value: unknown): value is string => typeof value === 'string';
const strOrNull = (value: unknown) => value === null || str(value);

function isSummary(value: unknown): value is VolunteerSummary {
  return isRecord(value) && str(value.id) && str(value.firstName) && str(value.lastName) && str(value.phone)
    && strOrNull(value.email) && (value.status === 'active' || value.status === 'inactive');
}

function isVolunteer(value: unknown): value is Volunteer {
  return isSummary(value) && isRecord(value) && strOrNull(value.birthDate) && str(value.emergencyContactName)
    && str(value.emergencyContactPhone) && strOrNull(value.notes) && str(value.createdAt) && str(value.updatedAt);
}

function volunteerFrom(result: unknown): Volunteer {
  if (!isRecord(result) || !isVolunteer(result.volunteer)) throw malformed();
  return result.volunteer;
}

export async function listVolunteers(params: { q: string; status: StatusFilter; page: number }) {
  const query = new URLSearchParams({ status: params.status, page: String(params.page), ...(params.q.trim() ? { q: params.q.trim() } : {}) });
  const result = await apiRequest(`/api/volunteers?${query.toString()}`);
  if (!isRecord(result) || !Array.isArray(result.volunteers) || typeof result.hasMore !== 'boolean') throw malformed();
  const volunteers = result.volunteers.filter(isSummary);
  if (volunteers.length !== result.volunteers.length) throw malformed();
  return { volunteers, hasMore: result.hasMore };
}

export async function getVolunteer(id: string): Promise<VolunteerDetail> {
  const result = await apiRequest(`/api/volunteers/${encodeURIComponent(id)}`);
  if (!isRecord(result) || !Array.isArray(result.history) || typeof result.totalHours !== 'number'
    || typeof result.completedActivities !== 'number') throw malformed();
  // History rows come from the server's own aggregation; only their outer shape is checked here.
  const history = result.history.filter((entry): entry is HistoryEntry =>
    isRecord(entry) && str(entry.assignmentId) && isRecord(entry.activity) && str(entry.activity.name));
  return { volunteer: volunteerFrom(result), history, totalHours: result.totalHours, completedActivities: result.completedActivities };
}

export async function createVolunteer(payload: Payload): Promise<Volunteer> {
  // On create an empty optional field is simply left out.
  const body = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ''));
  return volunteerFrom(await apiRequest('/api/volunteers', { method: 'POST', body }));
}

export async function updateVolunteer(id: string, payload: Payload): Promise<Volunteer> {
  return volunteerFrom(await apiRequest(`/api/volunteers/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }));
}

export async function setVolunteerStatus(id: string, status: VolunteerStatus): Promise<Volunteer> {
  return volunteerFrom(await apiRequest(`/api/volunteers/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } }));
}
