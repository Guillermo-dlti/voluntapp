// BAMX works in Guadalajara, so dates are shown in its timezone even if a phone is set elsewhere.
const timeZone = 'America/Mexico_City';

export function todayLabel(now = new Date()): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(now);
}

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function initials(fullName: string): string {
  return fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

// A calendar date (YYYY-MM-DD, such as a birth date) has no time or zone, so it's formatted in UTC
// to keep the same day everywhere.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function ageFrom(birthDate: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? age - 1 : age;
}

// An activity's moment (stored in UTC) shown as Guadalajara local date and time.
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));
}

// The last and first selectable birth dates: before today in Guadalajara, after 1900.
// `start` is where an empty picker opens: 25 years back, a typical volunteer's age.
export function birthDateRange(now = new Date()): { min: string; max: string; start: string } {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const max = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterday);
  return { min: '1900-01-02', max, start: `${Number(max.slice(0, 4)) - 25}-01-01` };
}

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// A moment as Guadalajara wall clock parts: { date: 'YYYY-MM-DD', time: 'HH:MM' }.
export function mexicoParts(moment: Date | string): { date: string; time: string } {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(moment)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// The UTC moment for a Guadalajara date and time. Forms work in Guadalajara wall clock time so a
// phone set to another zone still creates the shift staff meant; the offset is read from Intl twice,
// which stays right even if daylight saving ever returns.
export function mexicoMoment(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => {
    const { date: d, time: t } = mexicoParts(new Date(instant));
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return Date.UTC(y, mo - 1, da, h, mi) - instant;
  };
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant);
}

// "9:00 a.m." for a HH:MM wall clock time.
export function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

// An activity's schedule in one line: "3 oct 2026 · 9:00 a.m. a 1:00 p.m.", with both dates when it
// ends on another day.
export function formatSchedule(startsAt: string, endsAt: string): string {
  const start = mexicoParts(startsAt);
  const end = mexicoParts(endsAt);
  const day = (date: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  if (start.date === end.date) return `${day(start.date)} · ${formatTime(start.time)} a ${formatTime(end.time)}`;
  return `${day(start.date)}, ${formatTime(start.time)} a ${day(end.date)}, ${formatTime(end.time)}`;
}

// Today in Guadalajara as YYYY-MM-DD.
export function todayInMexico(now = new Date()): string {
  return mexicoParts(now).date;
}
