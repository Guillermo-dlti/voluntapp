import { formatDate, mexicoParts, todayInMexico } from '@/utils/time';

// Mirrors the API's range rules (server/src/reports.ts), which stay the real check.
export const MAX_RANGE_DAYS = 366;

export type RangePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface ReportRange {
  // YYYY-MM-DD, Guadalajara calendar days, both inclusive.
  from: string;
  to: string;
}

const pad = (value: number) => String(value).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Presets are whole calendar periods, computed from today in Guadalajara.
export function presetRange(preset: Exclude<RangePreset, 'custom'>, today = todayInMexico()): ReportRange {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (preset === 'thisYear') return { from: `${year}-01-01`, to: `${year}-12-31` };
  const [y, m] = preset === 'thisMonth' ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1];
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

// Field messages keyed like the API's `fields`, empty when the range is fine.
export function rangeErrors({ from, to }: ReportRange): Partial<Record<keyof ReportRange, string>> {
  const errors: Partial<Record<keyof ReportRange, string>> = {};
  if (!isCalendarDate(from)) errors.from = 'Elige una fecha de inicio válida.';
  if (!isCalendarDate(to)) errors.to = 'Elige una fecha de fin válida.';
  if (errors.from || errors.to) return errors;
  if (from > to) errors.to = 'La fecha de fin no puede ser anterior a la de inicio.';
  else if (Date.parse(to) - Date.parse(from) >= MAX_RANGE_DAYS * 86_400_000) errors.to = `El periodo puede abarcar hasta ${MAX_RANGE_DAYS} días.`;
  return errors;
}

export function rangeLabel({ from, to }: ReportRange): string {
  return from === to ? formatDate(from) : `${formatDate(from)} al ${formatDate(to)}`;
}

// Hours with up to 2 decimals, es-MX style.
export function formatHours(value: number): string {
  const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
  return `${number} ${value === 1 ? 'hora' : 'horas'}`;
}

// "13 oct 2026" for the Guadalajara day an activity starts on.
export function shortDay(iso: string): string {
  const day = mexicoParts(iso).date;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

export function plural(count: number, one: string, many: string): string {
  return `${new Intl.NumberFormat('es-MX').format(count)} ${count === 1 ? one : many}`;
}
