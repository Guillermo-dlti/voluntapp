import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Document, ObjectId } from 'mongodb';
import { z } from 'zod';
import { writeAudit } from './audit.js';
import type { Activity, V2Collections, Volunteer } from './collections.js';
import { addDays, isCalendarDate, mexicoDayStart, mexicoParts } from './common.js';
import { buildCsv, count, dateTime, hours, text, type CsvCell } from './csv.js';
import { log } from './logger.js';
import { currentStaff, requireStaff } from './session.js';

const MAX_DAYS = 366;
const PAGE_SIZE = 50;

// Strict: an unknown query parameter is a 400, not silently ignored.
const rangeSchema = z.strictObject({ from: z.string().max(10), to: z.string().max(10) });
const listSchema = rangeSchema.extend({
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE).default(PAGE_SIZE),
});

export interface Range {
  from: string;
  to: string;
  // Guadalajara midnight of `from`, and of the day after `to` (exclusive).
  start: Date;
  end: Date;
}

// The calendar month `now` falls in, in Guadalajara: the same range the app's "Este mes" preset sends.
export function currentMonthRange(now: Date): Range {
  const { year, month } = mexicoParts(now);
  const from = `${year}-${month}-01`;
  const nextFirst = month === '12' ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(nextFirst, -1), start: mexicoDayStart(from), end: mexicoDayStart(nextFirst) };
}

const badQuery = { message: 'La consulta del reporte no es válida. Elige el periodo de nuevo.' };

// Parses and checks the range; answers 400 itself and returns null when it's wrong.
function parseQuery<S extends typeof rangeSchema | typeof listSchema>(schema: S, request: Request, response: Response) {
  const parsed = schema.safeParse(request.query);
  if (!parsed.success) { response.status(400).json(badQuery); return null; }
  const { from, to } = parsed.data;
  const fields: Record<string, string> = {};
  if (!isCalendarDate(from)) fields.from = 'Elige una fecha de inicio válida.';
  if (!isCalendarDate(to)) fields.to = 'Elige una fecha de fin válida.';
  if (!Object.keys(fields).length) {
    if (from > to) fields.to = 'La fecha de fin no puede ser anterior a la de inicio.';
    else if (Date.parse(to) - Date.parse(from) >= MAX_DAYS * 86_400_000) fields.to = `El periodo puede abarcar hasta ${MAX_DAYS} días.`;
  }
  if (Object.keys(fields).length) {
    response.status(400).json({ message: 'Revisa el periodo del reporte.', fields });
    return null;
  }
  const range: Range = { from, to, start: mexicoDayStart(from), end: mexicoDayStart(addDays(to, 1)) };
  return { range, data: parsed.data as z.infer<S> };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const collator = new Intl.Collator('es-MX', { sensitivity: 'base' });

// An activity belongs to the day its startsAt falls on in Guadalajara, so each one lands in exactly
// one period. Finalized activities are always closed; `status` is matched so the index serves it.
export const inRange = (range: Range) => ({ status: { $in: ['open', 'closed'] as Activity['status'][] }, startsAt: { $gte: range.start, $lt: range.end } });
const finalizedInRange = (range: Range) => ({ ...inRange(range), attendanceFinalizedAt: { $exists: true } });

interface CountedRecord { activityId: ObjectId; volunteerId: ObjectId; status: 'present' | 'absent' | 'late'; hours: number }

// The one counting rule every report shares: finalized records of finalized activities in range.
// Assignment status isn't filtered because a record can't exist on a cancelled assignment (spec 0005).
function countedRecords(range: Range, groupStage: Document): Document[] {
  return [
    { $match: finalizedInRange(range) },
    { $project: { _id: 1 } },
    { $lookup: { from: 'assignments', localField: '_id', foreignField: 'activityId', as: 'assignment', pipeline: [{ $project: { volunteerId: 1 } }] } },
    { $unwind: '$assignment' },
    { $lookup: { from: 'attendance', localField: 'assignment._id', foreignField: 'assignmentId', as: 'record',
      pipeline: [{ $match: { finalized: true } }, { $project: { status: 1, hours: 1 } }] } },
    { $unwind: '$record' },
    { $project: { _id: 0, activityId: '$_id', volunteerId: '$assignment.volunteerId', status: '$record.status', hours: '$record.hours' } },
    groupStage,
  ];
}

const tally = {
  hours: { $sum: '$hours' },
  completed: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
  present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
  records: { $sum: 1 },
};
interface Tally { _id: ObjectId; hours: number; completed: number; present: number; late: number; absent: number; records: number }

export interface VolunteerHoursRow {
  volunteerId: ObjectId; firstName: string; lastName: string; status: Volunteer['status'];
  hours: number; completedActivities: number; lateCount: number; absentCount: number;
}

export interface ActivityAttendanceRow {
  activityId: ObjectId; name: string; location: string; startsAt: Date; endsAt: Date;
  recordCount: number; presentCount: number; lateCount: number; absentCount: number; totalHours: number; attendanceFinalizedAt: Date;
}

// Query functions: the JSON lists page these and the CSVs write all of them, so screen and file can't disagree.
export function reportQueries({ activities, volunteers }: V2Collections) {
  async function summary(range: Range) {
    const candidates = await activities.find(inRange(range), { projection: { startsAt: 1, attendanceStartedAt: 1, attendanceFinalizedAt: 1 } }).toArray();
    const now = new Date();
    const [totals] = await activities.aggregate<{ hours: number; volunteers: number; present: number; late: number; absent: number }>(countedRecords(range, {
      $group: {
        _id: null, hours: tally.hours, present: tally.present, late: tally.late, absent: tally.absent,
        volunteers: { $addToSet: { $cond: [{ $in: ['$status', ['present', 'late']] }, '$volunteerId', null] } },
      },
    }).concat({ $project: { hours: 1, present: 1, late: 1, absent: 1, volunteers: { $size: { $setDifference: ['$volunteers', [null]] } } } })).toArray();
    return {
      totalHours: round2(totals?.hours ?? 0),
      volunteersParticipated: totals?.volunteers ?? 0,
      presentCount: totals?.present ?? 0,
      lateCount: totals?.late ?? 0,
      absentCount: totals?.absent ?? 0,
      activitiesScheduled: candidates.length,
      activitiesHeld: candidates.filter((activity) => activity.attendanceFinalizedAt).length,
      pendingActivities: candidates.filter((activity) => !activity.attendanceFinalizedAt && (activity.startsAt < now || activity.attendanceStartedAt)).length,
    };
  }

  // Every active volunteer (zeros included) plus inactive ones who have counted records in range.
  async function volunteerHours(range: Range): Promise<VolunteerHoursRow[]> {
    const tallies = await activities.aggregate<Tally>(countedRecords(range, { $group: { _id: '$volunteerId', ...tally } })).toArray();
    const byVolunteer = new Map(tallies.map((entry) => [entry._id.toHexString(), entry]));
    const people = await volunteers.find(
      { $or: [{ status: 'active' }, { _id: { $in: tallies.map((entry) => entry._id) } }] },
      { projection: { firstName: 1, lastName: 1, status: 1 } },
    ).toArray();
    return people.map((person) => {
      const found = byVolunteer.get(person._id.toHexString());
      return {
        volunteerId: person._id, firstName: person.firstName, lastName: person.lastName, status: person.status,
        hours: round2(found?.hours ?? 0), completedActivities: found?.completed ?? 0, lateCount: found?.late ?? 0, absentCount: found?.absent ?? 0,
      };
    }).sort((a, b) => b.hours - a.hours || collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName)
      || a.volunteerId.toHexString().localeCompare(b.volunteerId.toHexString()));
  }

  async function activityAttendance(range: Range): Promise<ActivityAttendanceRow[]> {
    const held = await activities.find(finalizedInRange(range), {
      projection: { name: 1, location: 1, startsAt: 1, endsAt: 1, attendanceFinalizedAt: 1 },
    }).toArray();
    const tallies = await activities.aggregate<Tally>(countedRecords(range, { $group: { _id: '$activityId', ...tally } })).toArray();
    const byActivity = new Map(tallies.map((entry) => [entry._id.toHexString(), entry]));
    return held.map((activity) => {
      const found = byActivity.get(activity._id.toHexString());
      return {
        activityId: activity._id, name: activity.name, location: activity.location, startsAt: activity.startsAt, endsAt: activity.endsAt,
        recordCount: found?.records ?? 0, presentCount: found?.present ?? 0, lateCount: found?.late ?? 0, absentCount: found?.absent ?? 0,
        totalHours: round2(found?.hours ?? 0),
        // The query only returns activities where it is set.
        attendanceFinalizedAt: activity.attendanceFinalizedAt ?? activity.startsAt,
      };
    }).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || collator.compare(a.name, b.name)
      || a.activityId.toHexString().localeCompare(b.activityId.toHexString()));
  }

  return { summary, volunteerHours, activityAttendance };
}

const volunteerJson = (row: VolunteerHoursRow) => ({
  volunteerId: row.volunteerId.toHexString(), firstName: row.firstName, lastName: row.lastName, status: row.status,
  hours: row.hours, completedActivities: row.completedActivities, lateCount: row.lateCount, absentCount: row.absentCount,
});

const activityJson = (row: ActivityAttendanceRow) => ({
  activityId: row.activityId.toHexString(), name: row.name, location: row.location,
  startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(),
  recordCount: row.recordCount, presentCount: row.presentCount, lateCount: row.lateCount, absentCount: row.absentCount,
  totalHours: row.totalHours, attendanceFinalizedAt: row.attendanceFinalizedAt.toISOString(),
});

// Names and numbers only: no email, phone, birth date, emergency contact, or notes ever leave in a file.
const volunteerCsv = (rows: VolunteerHoursRow[]) => buildCsv(
  ['ID', 'Nombre', 'Apellidos', 'Estado', 'Horas', 'Actividades completadas', 'Retardos', 'Faltas'],
  rows.map((row): CsvCell[] => [
    text(row.volunteerId.toHexString()), text(row.firstName), text(row.lastName), text(row.status === 'active' ? 'Activo' : 'Inactivo'),
    hours(row.hours), count(row.completedActivities), count(row.lateCount), count(row.absentCount),
  ]),
);

const activityCsv = (rows: ActivityAttendanceRow[]) => buildCsv(
  ['ID', 'Actividad', 'Lugar', 'Inicio', 'Fin', 'Asignados', 'Presentes', 'Retardos', 'Faltas', 'Horas totales', 'Finalizada el'],
  rows.map((row): CsvCell[] => [
    text(row.activityId.toHexString()), text(row.name), text(row.location), dateTime(row.startsAt), dateTime(row.endsAt),
    count(row.recordCount), count(row.presentCount), count(row.lateCount), count(row.absentCount), hours(row.totalHours),
    dateTime(row.attendanceFinalizedAt),
  ]),
);

const exportFailed = { message: 'No pudimos generar el archivo. Inténtalo de nuevo en unos minutos.' };

export function reportsRouter(collections: V2Collections) {
  const router = Router();
  const queries = reportQueries(collections);
  router.use(requireStaff(collections.staffUsers, 'reports.view'));

  // Slows down a stolen session pulling file after file. Keyed by the staff id that requireStaff set,
  // shared by both CSV routes, and a 400 or 500 doesn't use up an export. In memory: resets on restart.
  const exportLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, skipFailedRequests: true,
    keyGenerator: (_request, response) => currentStaff(response).id.toHexString(),
    message: { message: 'Hiciste demasiadas exportaciones seguidas. Espera unos minutos e inténtalo de nuevo.' },
  });

  router.get('/summary', async (request, response) => {
    const parsed = parseQuery(rangeSchema, request, response);
    if (!parsed) return;
    response.json(await queries.summary(parsed.range));
  });

  router.get('/volunteer-hours', async (request, response) => {
    const parsed = parseQuery(listSchema, request, response);
    if (!parsed) return;
    const rows = await queries.volunteerHours(parsed.range);
    const { offset, limit } = parsed.data;
    response.json({ rows: rows.slice(offset, offset + limit).map(volunteerJson), total: rows.length });
  });

  router.get('/activity-attendance', async (request, response) => {
    const parsed = parseQuery(listSchema, request, response);
    if (!parsed) return;
    const rows = await queries.activityAttendance(parsed.range);
    const { offset, limit } = parsed.data;
    response.json({ rows: rows.slice(offset, offset + limit).map(activityJson), total: rows.length });
  });

  // The whole file is built before anything is audited or sent: a failed query answers 500 with no
  // audit entry, and a failed audit write means no file leaves.
  async function sendExport(response: Response, report: 'volunteer-hours' | 'activity-attendance', slug: string, range: Range, rowCount: number, csv: string) {
    const staff = currentStaff(response);
    try {
      await writeAudit(collections, {
        actorId: staff.id, action: 'export', collection: 'reports',
        after: { report, from: range.from, to: range.to, rowCount },
      });
    } catch {
      log.error('report_export_audit_failed', { staffId: staff.id.toHexString(), report });
      response.status(500).json(exportFailed);
      return;
    }
    log.info('report_exported', { staffId: staff.id.toHexString(), report, rowCount });
    // Built only from the validated YYYY-MM-DD strings, so nothing can break out of the header.
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${slug}-${range.from}_${range.to}.csv"`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(csv);
  }

  router.get('/volunteer-hours.csv', exportLimit, async (request, response) => {
    const parsed = parseQuery(rangeSchema, request, response);
    if (!parsed) return;
    const rows = await queries.volunteerHours(parsed.range);
    await sendExport(response, 'volunteer-hours', 'reporte-horas-voluntarios', parsed.range, rows.length, volunteerCsv(rows));
  });

  router.get('/activity-attendance.csv', exportLimit, async (request, response) => {
    const parsed = parseQuery(rangeSchema, request, response);
    if (!parsed) return;
    const rows = await queries.activityAttendance(parsed.range);
    await sendExport(response, 'activity-attendance', 'reporte-asistencia-actividades', parsed.range, rows.length, activityCsv(rows));
  });

  return router;
}
