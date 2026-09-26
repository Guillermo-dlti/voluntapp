// Mirrors the zod rules and messages in server/src/activities.ts, which are the source of truth.
// The copy here only gives staff feedback before sending; the API checks everything again.
import { mexicoMoment, mexicoParts, todayInMexico } from '@/utils/time';

export interface ActivityDraft {
  name: string;
  location: string;
  description: string;
  requirements: string;
  date: string; // YYYY-MM-DD, Guadalajara
  startTime: string; // HH:MM
  endTime: string; // HH:MM; at or before the start means the next day
  capacity: string;
  supervisorId: string; // '' for none
}

export type ActivityField = keyof ActivityDraft;
export type ActivityErrors = Partial<Record<ActivityField, string>>;

export const emptyActivityDraft: ActivityDraft = {
  name: '', location: '', description: '', requirements: '', date: '', startTime: '', endTime: '', capacity: '', supervisorId: '',
};

export const activityMessages = {
  name: 'Escribe el nombre de la actividad (de 3 a 120 caracteres).',
  location: 'Escribe el lugar (de 2 a 200 caracteres).',
  description: 'La descripción puede tener hasta 2000 caracteres.',
  requirements: 'Los requisitos pueden tener hasta 1000 caracteres.',
  date: 'Elige una fecha entre 2020 y dentro de dos años.',
  startTime: 'Elige la hora de inicio.',
  endTime: 'El fin debe ser después del inicio, y la actividad puede durar hasta 24 horas.',
  capacity: 'Escribe un cupo de 1 a 1000 personas.',
  supervisorId: 'Elige a alguien de la lista de supervisores activos.',
} as const satisfies Record<ActivityField, string>;

// Where the API's field names land in the form.
export const serverFieldToDraft: Record<string, ActivityField> = {
  name: 'name', location: 'location', description: 'description', requirements: 'requirements',
  startsAt: 'date', endsAt: 'endTime', capacity: 'capacity', supervisorId: 'supervisorId',
};

const controlChars = /\p{Cc}/u;

export function activityDateRange(now = new Date()): { min: string; max: string; start: string } {
  const today = todayInMexico(now);
  return { min: '2020-01-01', max: `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`, start: today };
}

// An end time at or before the start time is read as the next day, so night shifts need no end date.
export function endsNextDay(draft: Pick<ActivityDraft, 'startTime' | 'endTime'>): boolean {
  return Boolean(draft.startTime && draft.endTime && draft.endTime <= draft.startTime);
}

export function draftMoments(draft: ActivityDraft): { startsAt: Date; endsAt: Date } {
  const startsAt = mexicoMoment(draft.date, draft.startTime);
  let endsAt = mexicoMoment(draft.date, draft.endTime);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

function textOk(value: string, min: number, max: number) {
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max && !controlChars.test(trimmed);
}

export function validateActivity(draft: ActivityDraft): ActivityErrors {
  const errors: ActivityErrors = {};
  if (!textOk(draft.name, 3, 120)) errors.name = activityMessages.name;
  if (!textOk(draft.location, 2, 200)) errors.location = activityMessages.location;
  if (draft.description.trim().length > 2000) errors.description = activityMessages.description;
  if (draft.requirements.trim().length > 1000) errors.requirements = activityMessages.requirements;
  const range = activityDateRange();
  if (!draft.date || draft.date < range.min || draft.date > range.max) errors.date = activityMessages.date;
  if (!draft.startTime) errors.startTime = activityMessages.startTime;
  if (!draft.endTime) errors.endTime = activityMessages.endTime;
  const capacity = Number(draft.capacity);
  if (!/^\d+$/.test(draft.capacity.trim()) || capacity < 1 || capacity > 1000) errors.capacity = activityMessages.capacity;
  return errors;
}

// The body the API expects. Optional fields go as '' so an edit can clear them.
export function activityPayload(draft: ActivityDraft) {
  const { startsAt, endsAt } = draftMoments(draft);
  return {
    name: draft.name.trim(),
    location: draft.location.trim(),
    description: draft.description.trim(),
    requirements: draft.requirements.trim(),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    capacity: Number(draft.capacity),
    supervisorId: draft.supervisorId,
  };
}

export function draftFromActivity(activity: {
  name: string; location: string; description: string | null; requirements: string | null;
  startsAt: string; endsAt: string; capacity: number; supervisorId: string | null;
}): ActivityDraft {
  const start = mexicoParts(activity.startsAt);
  return {
    name: activity.name,
    location: activity.location,
    description: activity.description ?? '',
    requirements: activity.requirements ?? '',
    date: start.date,
    startTime: start.time,
    endTime: mexicoParts(activity.endsAt).time,
    capacity: String(activity.capacity),
    supervisorId: activity.supervisorId ?? '',
  };
}
