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
