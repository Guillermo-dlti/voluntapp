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
