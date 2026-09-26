// Mirrors the rules and messages in server/src/attendance.ts, which are the source of truth.
// The copy here only gives staff feedback before sending; the API checks everything again.
import type { AttendancePayload, AttendanceRecord, AttendanceStatus } from '@/services/activities';
import { mexicoMoment, mexicoParts } from '@/utils/time';

export interface AttendanceDraft {
  status: AttendanceStatus | '';
  checkIn: string; // HH:MM Guadalajara, '' for none
  checkOut: string; // HH:MM Guadalajara, '' for none
  // '' means "calculate it": the API fills in the default.
  hours: string;
  reason: string; // correction only
}

export type AttendanceField = keyof AttendanceDraft;
export type AttendanceErrors = Partial<Record<AttendanceField, string>>;

interface ActivityWindow { startsAt: string; endsAt: string }

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: 'Presente',
  late: 'Tarde',
  absent: 'Ausente',
};

export const attendanceMessages = {
  status: 'Elige si asistió, llegó tarde o faltó.',
  checkIn: 'La entrada debe estar dentro del horario de la actividad.',
  checkOut: 'La salida debe estar dentro del horario de la actividad.',
  checkOutOrder: 'La salida debe ser después de la entrada.',
  hours: 'Escribe las horas como un número, con hasta 2 decimales.',
  reason: 'Escribe el motivo de la corrección (de 3 a 500 caracteres).',
} as const;

// Where the API's field names land in the form.
export const serverFieldToAttendance: Record<string, AttendanceField> = {
  status: 'status', checkInAt: 'checkIn', checkOutAt: 'checkOut', hours: 'hours', reason: 'reason',
};

const HOUR_MS = 60 * 60 * 1000;
const round = (value: number) => Math.round(value * 100) / 100;
export const hoursText = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);

// A wall clock time placed on the date that falls inside the activity: for an activity that crosses
// midnight, a time earlier than the start time belongs to the next day.
export function placeTime(time: string, activity: ActivityWindow): Date {
  const start = mexicoParts(activity.startsAt);
  const end = mexicoParts(activity.endsAt);
  return mexicoMoment(start.date !== end.date && time < start.time ? end.date : start.date, time);
}

export function activityLength(activity: ActivityWindow): number {
  return round((new Date(activity.endsAt).getTime() - new Date(activity.startsAt).getTime()) / HOUR_MS);
}

// The most hours this draft allows: the check in to check out span when both times are set, else the
// activity's length. Absent is always 0.
export function maxHours(draft: AttendanceDraft, activity: ActivityWindow): number {
  if (draft.status === 'absent') return 0;
  const length = activityLength(activity);
  if (!draft.checkIn || !draft.checkOut) return length;
  const span = (placeTime(draft.checkOut, activity).getTime() - placeTime(draft.checkIn, activity).getTime()) / HOUR_MS;
  return span > 0 ? Math.min(round(span), length) : length;
}

function parseHours(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  return /^\d{1,2}(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : null;
}

export function validateAttendance(draft: AttendanceDraft, activity: ActivityWindow, correcting: boolean): AttendanceErrors {
  const errors: AttendanceErrors = {};
  if (!draft.status) errors.status = attendanceMessages.status;
  if (draft.status && draft.status !== 'absent') {
    const inWindow = (date: Date) => date >= new Date(activity.startsAt) && date <= new Date(activity.endsAt);
    const checkIn = draft.checkIn ? placeTime(draft.checkIn, activity) : null;
    const checkOut = draft.checkOut ? placeTime(draft.checkOut, activity) : null;
    if (checkIn && !inWindow(checkIn)) errors.checkIn = attendanceMessages.checkIn;
    if (checkOut && !inWindow(checkOut)) errors.checkOut = attendanceMessages.checkOut;
    else if (checkIn && checkOut && checkOut <= checkIn) errors.checkOut = attendanceMessages.checkOutOrder;
  }
  if (draft.status && draft.hours.trim()) {
    const hours = parseHours(draft.hours);
    const limit = maxHours(draft, activity);
    if (hours === null) errors.hours = attendanceMessages.hours;
    else if (draft.status === 'absent' && hours !== 0) errors.hours = 'Una falta cuenta 0 horas.';
    else if (hours > limit) errors.hours = `Pueden ser hasta ${hoursText(limit)} ${limit === 1 ? 'hora' : 'horas'}.`;
  }
  const reason = draft.reason.trim();
  if (correcting && (reason.length < 3 || reason.length > 500)) errors.reason = attendanceMessages.reason;
  return errors;
}

// The body the API expects. Times go as ISO with offset; empty hours are left for the API to calculate.
export function attendancePayload(draft: AttendanceDraft, activity: ActivityWindow): AttendancePayload {
  const status = draft.status || 'present';
  const hours = parseHours(draft.hours);
  if (status === 'absent') return { status };
  return {
    status,
    ...(draft.checkIn ? { checkInAt: placeTime(draft.checkIn, activity).toISOString() } : {}),
    ...(draft.checkOut ? { checkOutAt: placeTime(draft.checkOut, activity).toISOString() } : {}),
    ...(draft.hours.trim() && hours !== null ? { hours } : {}),
  };
}

// A draft for an existing record. Hours stay blank (calculated) when they match what the API would
// calculate anyway, so changing a time also updates them.
export function draftFromRecord(record: AttendanceRecord | null, activity: ActivityWindow): AttendanceDraft {
  if (!record) return { status: '', checkIn: '', checkOut: '', hours: '', reason: '' };
  const draft: AttendanceDraft = {
    status: record.status,
    checkIn: record.checkInAt ? mexicoParts(record.checkInAt).time : '',
    checkOut: record.checkOutAt ? mexicoParts(record.checkOutAt).time : '',
    hours: '',
    reason: '',
  };
  return { ...draft, hours: record.hours === maxHours(draft, activity) ? '' : String(record.hours) };
}
