import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { ApiError, apiDownload, apiRequest } from '@/services/api';
import type { ReportRange } from '@/utils/report-range';

export interface ReportSummary {
  totalHours: number;
  volunteersParticipated: number;
  activitiesHeld: number;
  pendingActivities: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

export interface VolunteerHoursRow {
  volunteerId: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  hours: number;
  completedActivities: number;
  lateCount: number;
  absentCount: number;
}

export interface ActivityAttendanceRow {
  activityId: string;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  recordCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalHours: number;
  attendanceFinalizedAt: string;
}

export interface ReportPage<T> {
  rows: T[];
  total: number;
}

export type ReportKind = 'volunteer-hours' | 'activity-attendance';

const malformed = () => new ApiError('Recibimos una respuesta inesperada del servidor. Inténtalo de nuevo.');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
const str = (value: unknown): value is string => typeof value === 'string';
const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isVolunteerRow(value: unknown): value is VolunteerHoursRow {
  return isRecord(value) && str(value.volunteerId) && str(value.firstName) && str(value.lastName)
    && (value.status === 'active' || value.status === 'inactive') && num(value.hours)
    && num(value.completedActivities) && num(value.lateCount) && num(value.absentCount);
}

function isActivityRow(value: unknown): value is ActivityAttendanceRow {
  return isRecord(value) && str(value.activityId) && str(value.name) && str(value.location) && str(value.startsAt)
    && str(value.endsAt) && num(value.recordCount) && num(value.presentCount) && num(value.lateCount)
    && num(value.absentCount) && num(value.totalHours) && str(value.attendanceFinalizedAt);
}

const rangeQuery = (range: ReportRange, extra: Record<string, string> = {}) =>
  new URLSearchParams({ from: range.from, to: range.to, ...extra }).toString();

export async function getSummary(range: ReportRange): Promise<ReportSummary> {
  const result = await apiRequest(`/api/reports/summary?${rangeQuery(range)}`);
  if (!isRecord(result) || !num(result.totalHours) || !num(result.volunteersParticipated)
    || !num(result.activitiesHeld) || !num(result.pendingActivities)
    || !num(result.presentCount) || !num(result.lateCount) || !num(result.absentCount)) throw malformed();
  return {
    totalHours: result.totalHours,
    volunteersParticipated: result.volunteersParticipated,
    activitiesHeld: result.activitiesHeld,
    pendingActivities: result.pendingActivities,
    presentCount: result.presentCount,
    lateCount: result.lateCount,
    absentCount: result.absentCount,
  };
}

async function listPage<T>(kind: ReportKind, range: ReportRange, offset: number, limit: number, isRow: (value: unknown) => value is T): Promise<ReportPage<T>> {
  const result = await apiRequest(`/api/reports/${kind}?${rangeQuery(range, { offset: String(offset), limit: String(limit) })}`);
  if (!isRecord(result) || !Array.isArray(result.rows) || !num(result.total)) throw malformed();
  const rows = result.rows.filter(isRow);
  if (rows.length !== result.rows.length) throw malformed();
  return { rows, total: result.total };
}

export const listVolunteerHours = (range: ReportRange, offset: number, limit = 50) =>
  listPage('volunteer-hours', range, offset, limit, isVolunteerRow);

export const listActivityAttendance = (range: ReportRange, offset: number, limit = 50) =>
  listPage('activity-attendance', range, offset, limit, isActivityRow);

const fileSlugs: Record<ReportKind, string> = {
  'volunteer-hours': 'reporte-horas-voluntarios',
  'activity-attendance': 'reporte-asistencia-actividades',
};
const reportFile = /^reporte-.*\.csv$/;

// Report files only ever live in the app's private cache; leftovers from an earlier export go first.
function removeOldReports() {
  for (const entry of Paths.cache.list()) {
    if (entry instanceof File && reportFile.test(entry.name)) {
      try { entry.delete(); } catch { /* Already gone; nothing to clean. */ }
    }
  }
}

const fileName = (kind: ReportKind, range: ReportRange) => `${fileSlugs[kind]}-${range.from}_${range.to}.csv`;
const fetchCsv = (kind: ReportKind, range: ReportRange) => apiDownload(`/api/reports/${kind}.csv?${rangeQuery(range)}`);
// Android's HTTP client drops the byte order mark while decoding; Excel needs it to read accents as UTF-8.
const withBom = (csv: string) => (csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`);

// Downloads the server-built CSV, saves it in the cache, and opens the share sheet.
export async function shareReport(kind: ReportKind, range: ReportRange): Promise<void> {
  try { removeOldReports(); } catch { /* A cache we can't list doesn't stop the export. */ }
  const csv = await fetchCsv(kind, range);
  const file = new File(Paths.cache, fileName(kind, range));
  try {
    file.create({ overwrite: true });
    file.write(withBom(csv));
    await shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Compartir reporte' });
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('No pudimos guardar ni compartir el archivo. Inténtalo de nuevo.');
  } finally {
    try { if (file.exists) file.delete(); } catch { /* removeOldReports catches it next time. */ }
  }
}

// The picker opens in Descargas. Android doesn't let an app use Descargas itself, only a folder
// inside it (the picker offers "Crear carpeta"), so staff save into one such as "Reportes BAMX".
const downloadsFolder = 'content://com.android.externalstorage.documents/document/primary%3ADownload';

// Saves the CSV in a folder staff pick with Android's own picker (no storage permission needed).
// The folder is picked before downloading, so cancelling never counts as an export in the audit log.
// Returns false when the picker was closed without a folder.
export async function downloadReport(kind: ReportKind, range: ReportRange): Promise<boolean> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync(downloadsFolder);
  } catch {
    return false;
  }
  const csv = await fetchCsv(kind, range);
  try {
    // An existing file with the same name is kept; Android adds " (1)" to the new one.
    folder.createFile(fileName(kind, range), 'text/csv').write(withBom(csv));
  } catch {
    throw new ApiError('No pudimos guardar el archivo en esa carpeta. Elige otra, por ejemplo una carpeta dentro de Descargas, e inténtalo de nuevo.');
  }
  return true;
}
