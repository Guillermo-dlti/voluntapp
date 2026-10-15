import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ObjectId, type ClientSession, type MongoClient } from 'mongodb';
import { z } from 'zod';
import { attendanceOpened, publicActivity, publicAttendance } from './activities.js';
import { writeAudit } from './audit.js';
import { CHECKIN_TOKEN_PATTERN } from './checkin-token.js';
import type { Activity, Attendance, V2Collections } from './collections.js';
import { answering, conflict, HttpError, inTransaction, jsonBody, noControlChars, parseId } from './common.js';
import { log } from './logger.js';
import { canOnActivity, type Capability } from './permissions.js';
import { currentStaff, requireStaff, type AuthenticatedStaff } from './session.js';

const HOUR_MS = 60 * 60 * 1000;
// A QR scan this long after the start time records the volunteer as late.
const LATE_AFTER_MINUTES = 15;

const fieldMessages = {
  status: 'Elige si asistió, llegó tarde o faltó.',
  checkInAt: 'La entrada debe estar dentro del horario de la actividad.',
  checkOutAt: 'La salida debe estar dentro del horario de la actividad.',
  hours: 'Escribe las horas como un número de 0 en adelante.',
  reason: 'Escribe el motivo de la corrección (de 3 a 500 caracteres).',
} as const;
type Field = keyof typeof fieldMessages;
type FieldErrors = Partial<Record<Field, string>>;

const moment = z.iso.datetime({ offset: true });
const recordFields = {
  status: z.enum(['present', 'late', 'absent']),
  checkInAt: moment.optional(),
  checkOutAt: moment.optional(),
  hours: z.number().min(0).max(24).optional(),
};
const recordSchema = z.strictObject(recordFields);
const correctSchema = z.strictObject({ ...recordFields, reason: z.string().trim().min(3).max(500).regex(noControlChars) });
type RecordInput = z.infer<typeof recordSchema>;
const checkInSchema = z.strictObject({ token: z.string().regex(CHECKIN_TOKEN_PATTERN) });

const statusWords: Record<Attendance['status'], string> = { present: 'Presente', late: 'Llegó tarde', absent: 'Falta' };
// A junk QR and an unknown token answer the same, so a scan can't tell which codes exist.
const invalidCode = { outcome: 'invalid', message: 'Código no válido', volunteer: null, attendance: null };

const notFound = { message: 'No encontramos esa actividad. Puede que el enlace ya no sea válido.' };
const assignmentNotFound = { message: 'No encontramos esa asignación. Actualiza la actividad e inténtalo de nuevo.' };
const forbidden = { message: 'Solo el supervisor de esta actividad, Coordinación o Administración pueden registrar su asistencia.' };

const round = (value: number) => Math.round(value * 100) / 100;
const hoursText = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);

function invalid(response: Response, error: z.ZodError) {
  const fields: FieldErrors = {};
  let unknownField = false;
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') unknownField = true;
    const key = issue.path[0];
    if (typeof key === 'string' && key in fieldMessages) fields[key as Field] = fieldMessages[key as Field];
  }
  const message = unknownField && !Object.keys(fields).length ? 'Se enviaron datos que no se pueden guardar.' : 'Revisa los campos marcados.';
  response.status(400).json({ message, fields });
}

// The values to store for a record, applying spec 0005's time and hours rules against the activity.
// Hours are rounded first, then compared with limits that are rounded the same way.
export function attendanceValues(input: RecordInput, activity: Pick<Activity, 'startsAt' | 'endsAt'>) {
  const errors: FieldErrors = {};
  const checkInAt = input.checkInAt ? new Date(input.checkInAt) : undefined;
  const checkOutAt = input.checkOutAt ? new Date(input.checkOutAt) : undefined;
  const length = round((activity.endsAt.getTime() - activity.startsAt.getTime()) / HOUR_MS);
  let hours: number;

  if (input.status === 'absent') {
    if (checkInAt) errors.checkInAt = 'Una falta no lleva hora de entrada.';
    if (checkOutAt) errors.checkOutAt = 'Una falta no lleva hora de salida.';
    if (input.hours !== undefined && round(input.hours) !== 0) errors.hours = 'Una falta cuenta 0 horas.';
    hours = 0;
  } else {
    const inWindow = (date: Date) => date >= activity.startsAt && date <= activity.endsAt;
    if (checkInAt && !inWindow(checkInAt)) errors.checkInAt = fieldMessages.checkInAt;
    if (checkOutAt && !inWindow(checkOutAt)) errors.checkOutAt = fieldMessages.checkOutAt;
    else if (checkInAt && checkOutAt && checkOutAt <= checkInAt) errors.checkOutAt = 'La salida debe ser después de la entrada.';
    const span = checkInAt && checkOutAt && checkOutAt > checkInAt ? round((checkOutAt.getTime() - checkInAt.getTime()) / HOUR_MS) : null;
    const limit = span === null ? length : Math.min(span, length);
    hours = input.hours === undefined ? limit : round(input.hours);
    if (hours > limit) {
      const unit = limit === 1 ? 'hora' : 'horas';
      errors.hours = span === null
        ? `Pueden ser hasta ${hoursText(limit)} ${unit}, lo que dura la actividad.`
        : `Pueden ser hasta ${hoursText(limit)} ${unit}, de la entrada a la salida.`;
    }
  }
  if (Object.keys(errors).length) throw new HttpError(400, { message: 'Revisa los campos marcados.', fields: errors });
  return { status: input.status, checkInAt: input.status === 'absent' ? undefined : checkInAt, checkOutAt: input.status === 'absent' ? undefined : checkOutAt, hours };
}

type Values = ReturnType<typeof attendanceValues>;

// $set for the stored fields, and $unset for times the new values leave out.
function valuesUpdate(values: Values) {
  const set: Partial<Attendance> = { status: values.status, hours: values.hours };
  const unset: Partial<Record<'checkInAt' | 'checkOutAt', ''>> = {};
  if (values.checkInAt) set.checkInAt = values.checkInAt; else unset.checkInAt = '';
  if (values.checkOutAt) set.checkOutAt = values.checkOutAt; else unset.checkOutAt = '';
  return { set, unset };
}

// Why the conditional stamp on the activity matched nothing, as a sentence for staff.
function lockRefusal(activity: Activity, now: Date): string {
  if (activity.status === 'draft') return 'La actividad está en borrador. La asistencia se registra cuando está publicada y ya empezó.';
  if (activity.status === 'cancelled') return 'La actividad está cancelada, así que no lleva asistencia.';
  if (activity.attendanceFinalizedAt) return 'La asistencia de esta actividad ya está finalizada. Solo Administración puede corregirla.';
  if (activity.startsAt > now && !activity.attendanceStartedAt) return 'La actividad todavía no empieza. Usa «Iniciar asistencia» para tomarla antes de la hora de inicio.';
  return 'La actividad cambió mientras guardabas. Actualízala e inténtalo de nuevo.';
}

// Why "Iniciar asistencia" matched nothing, as a sentence for staff.
function startRefusal(activity: Activity, now: Date): string {
  if (activity.status === 'draft') return 'La actividad está en borrador. Publícala antes de iniciar la asistencia.';
  if (activity.status === 'cancelled') return 'La actividad está cancelada, así que no lleva asistencia.';
  if (activity.attendanceFinalizedAt) return 'La asistencia de esta actividad ya está finalizada.';
  if (activity.attendanceStartedAt || activity.startsAt <= now) return 'La asistencia de esta actividad ya está abierta.';
  return 'La actividad cambió mientras guardabas. Actualízala e inténtalo de nuevo.';
}

export function attendanceRouter(collections: V2Collections, client: MongoClient) {
  const { staffUsers, volunteers, activities, assignments, attendance } = collections;
  const router = Router();
  const transaction = <T>(work: (session: ClientSession) => Promise<T>) => inTransaction(client, work);

  async function loadActivity(id: ObjectId, staff: AuthenticatedStaff, capability: Capability, session: ClientSession) {
    const activity = await activities.findOne({ _id: id }, { session });
    if (!activity) throw new HttpError(404, notFound);
    if (!canOnActivity(staff.role, capability, staff.id.toHexString(), activity.supervisorId?.toHexString())) throw new HttpError(403, forbidden);
    return activity;
  }

  // Every attendance write starts here. Writing the activity first is what makes a concurrent finalize,
  // assign, or cancel on it collide, so withTransaction retries the loser against the committed state.
  async function stampOpen(activity: Activity, now: Date, session: ClientSession) {
    const stamped = await activities.updateOne(
      { _id: activity._id, status: { $in: ['open', 'closed'] }, attendanceFinalizedAt: { $exists: false }, ...attendanceOpened(now) },
      { $set: { attendanceLock: new ObjectId() } },
      { session },
    );
    if (!stamped.matchedCount) throw conflict(lockRefusal(activity, now));
  }

  async function loadAssignment(activityId: ObjectId, assignmentId: ObjectId, session: ClientSession) {
    const assignment = await assignments.findOne({ _id: assignmentId, activityId }, { session });
    if (!assignment) throw new HttpError(404, assignmentNotFound);
    if (assignment.status === 'cancelled') throw conflict('Esta asignación está cancelada, así que no lleva asistencia.');
    return assignment;
  }

  router.put('/:id/attendance/:assignmentId', requireStaff(staffUsers, 'attendance.record'), async (request, response) => {
    const activityId = parseId(request.params.id);
    const assignmentId = parseId(request.params.assignmentId);
    if (!activityId) { response.status(404).json(notFound); return; }
    if (!assignmentId) { response.status(404).json(assignmentNotFound); return; }
    if (!jsonBody(request, response)) return;
    const parsed = recordSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const staff = currentStaff(response);
    const now = new Date();
    await answering(response, async () => {
      const { record, created } = await transaction(async (session) => {
        const activity = await loadActivity(activityId, staff, 'attendance.record', session);
        await stampOpen(activity, now, session);
        await loadAssignment(activityId, assignmentId, session);
        const values = attendanceValues(parsed.data, activity);
        const before = await attendance.findOne({ assignmentId }, { session });
        if (before) {
          const { set, unset } = valuesUpdate(values);
          const after = await attendance.findOneAndUpdate(
            { _id: before._id, finalized: false },
            { $set: { ...set, method: 'manual', recordedBy: staff.id, updatedAt: now }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
            { session, returnDocument: 'after' },
          );
          if (!after) throw conflict('La asistencia de esta actividad ya está finalizada. Solo Administración puede corregirla.');
          await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'attendance', recordId: after._id, before, after }, session);
          return { record: after, created: false };
        }
        const inserted: Attendance = {
          _id: new ObjectId(),
          assignmentId,
          status: values.status,
          ...(values.checkInAt ? { checkInAt: values.checkInAt } : {}),
          ...(values.checkOutAt ? { checkOutAt: values.checkOutAt } : {}),
          hours: values.hours,
          method: 'manual',
          recordedBy: staff.id,
          finalized: false,
          createdAt: now,
          updatedAt: now,
        };
        await attendance.insertOne(inserted, { session });
        await writeAudit(collections, { actorId: staff.id, action: 'insert', collection: 'attendance', recordId: inserted._id, after: inserted }, session);
        return { record: inserted, created: true };
      });
      log.info(created ? 'attendance_recorded' : 'attendance_updated', {
        attendanceId: record._id.toHexString(), activityId: activityId.toHexString(), staffId: staff.id.toHexString(),
      });
      response.status(created ? 201 : 200).json({ attendance: publicAttendance(record) });
    });
  });

  // Opens attendance before the start time, so staff don't have to wait for the clock (the volunteers
  // are already there, or the activity started early). Same roles as recording; check in and check out
  // times must still fall inside the activity's schedule.
  router.post('/:id/attendance/start', requireStaff(staffUsers, 'attendance.record'), async (request, response) => {
    const activityId = parseId(request.params.id);
    if (!activityId) { response.status(404).json(notFound); return; }
    const staff = currentStaff(response);
    const now = new Date();
    await answering(response, async () => {
      const activity = await transaction(async (session) => {
        const before = await loadActivity(activityId, staff, 'attendance.record', session);
        const after = await activities.findOneAndUpdate(
          { _id: activityId, status: { $in: ['open', 'closed'] }, attendanceFinalizedAt: { $exists: false }, startsAt: { $gt: now }, attendanceStartedAt: { $exists: false } },
          { $set: { attendanceStartedAt: now, attendanceStartedBy: staff.id, updatedAt: now } },
          { session, returnDocument: 'after' },
        );
        if (!after) throw conflict(startRefusal(before, now));
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'activities', recordId: activityId, before, after }, session);
        return after;
      });
      log.info('attendance_started', { activityId: activityId.toHexString(), staffId: staff.id.toHexString() });
      response.json({ activity: publicActivity(activity) });
    });
  });

  router.post('/:id/attendance/mark-all-present', requireStaff(staffUsers, 'attendance.record'), async (request, response) => {
    const activityId = parseId(request.params.id);
    if (!activityId) { response.status(404).json(notFound); return; }
    const staff = currentStaff(response);
    const now = new Date();
    await answering(response, async () => {
      const created = await transaction(async (session) => {
        const activity = await loadActivity(activityId, staff, 'attendance.record', session);
        await stampOpen(activity, now, session);
        const assigned = await assignments.find({ activityId, status: 'assigned' }, { session, projection: { _id: 1 } }).toArray();
        const recorded = await attendance.find({ assignmentId: { $in: assigned.map((entry) => entry._id) } }, { session, projection: { assignmentId: 1 } }).toArray();
        const done = new Set(recorded.map((entry) => entry.assignmentId.toHexString()));
        const hours = attendanceValues({ status: 'present' }, activity).hours;
        const records: Attendance[] = assigned.filter((entry) => !done.has(entry._id.toHexString())).map((entry) => ({
          _id: new ObjectId(), assignmentId: entry._id, status: 'present', hours, method: 'manual', recordedBy: staff.id, finalized: false, createdAt: now, updatedAt: now,
        }));
        if (!records.length) return 0;
        await attendance.insertMany(records, { session });
        for (const record of records) {
          await writeAudit(collections, { actorId: staff.id, action: 'insert', collection: 'attendance', recordId: record._id, after: record }, session);
        }
        return records.length;
      });
      log.info('attendance_marked_all_present', { activityId: activityId.toHexString(), created, staffId: staff.id.toHexString() });
      response.json({ created });
    });
  });

  // Records attendance from a volunteer's QR. Only the token arrives, so the server resolves the volunteer,
  // their assignment and the times itself, behind the same gate and audit as the roll call. It only ever
  // inserts: a volunteer who already has a record answers 'already' and nothing changes.
  const checkInLimit = rateLimit({
    windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (_request, response) => currentStaff(response).id.toHexString(),
    message: { message: 'Demasiados escaneos seguidos. Espera un minuto y vuelve a escanear.' },
  });

  router.post('/:id/attendance/check-in', requireStaff(staffUsers, 'attendance.record'), checkInLimit, async (request, response) => {
    const activityId = parseId(request.params.id);
    if (!activityId) { response.status(404).json(notFound); return; }
    if (!jsonBody(request, response)) return;
    const staff = currentStaff(response);
    const parsed = checkInSchema.safeParse(request.body);
    if (!parsed.success) {
      log.info('attendance_checkin', { activityId: activityId.toHexString(), staffId: staff.id.toHexString(), outcome: 'invalid' });
      response.status(404).json(invalidCode);
      return;
    }
    const now = new Date();
    await answering(response, async () => {
      try {
        const result = await transaction(async (session) => {
          const activity = await loadActivity(activityId, staff, 'attendance.record', session);
          await stampOpen(activity, now, session);
          if (now >= activity.endsAt) throw conflict('La actividad ya terminó. Registra la asistencia en la lista.');
          const volunteer = await volunteers.findOne({ checkinToken: parsed.data.token }, { session, projection: { firstName: 1, lastName: 1, status: 1 } });
          if (!volunteer) throw new HttpError(404, invalidCode);
          const name = `${volunteer.firstName} ${volunteer.lastName}`;
          const assignment = await assignments.findOne({ volunteerId: volunteer._id, activityId, status: 'assigned' }, { session });
          if (!assignment) {
            throw conflict(`${name} no tiene lugar en esta actividad.`, { outcome: 'not_assigned', volunteer: { name }, attendance: null });
          }
          if (volunteer.status === 'inactive') {
            throw conflict(`${name} tiene el registro inactivo. Reactívalo en Voluntarios para registrar su asistencia.`,
              { outcome: 'inactive', volunteer: { name }, attendance: null });
          }

          const counts = async () => {
            const assigned = await assignments.find({ activityId, status: 'assigned' }, { session, projection: { _id: 1 } }).toArray();
            const recorded = await attendance.countDocuments({ assignmentId: { $in: assigned.map((entry) => entry._id) } }, { session });
            return { recorded, assigned: activity.assignedCount };
          };
          const existing = await attendance.findOne({ assignmentId: assignment._id }, { session });
          if (existing) {
            return { created: null, outcome: 'already' as const, name, record: existing, counts: await counts() };
          }

          // Early scans (attendance started before the start time) count from the start, keeping spec 0005's
          // "times inside the schedule" rule.
          const checkInAt = now < activity.startsAt ? activity.startsAt : now;
          const status = now.getTime() > activity.startsAt.getTime() + LATE_AFTER_MINUTES * 60_000 ? 'late' : 'present';
          const values = attendanceValues({ status, checkInAt: checkInAt.toISOString(), checkOutAt: activity.endsAt.toISOString() }, activity);
          const inserted: Attendance = {
            _id: new ObjectId(),
            assignmentId: assignment._id,
            status: values.status,
            ...(values.checkInAt ? { checkInAt: values.checkInAt } : {}),
            ...(values.checkOutAt ? { checkOutAt: values.checkOutAt } : {}),
            hours: values.hours,
            method: 'qr',
            recordedBy: staff.id,
            finalized: false,
            createdAt: now,
            updatedAt: now,
          };
          await attendance.insertOne(inserted, { session });
          await writeAudit(collections, { actorId: staff.id, action: 'insert', collection: 'attendance', recordId: inserted._id, after: inserted }, session);
          return { created: inserted._id, outcome: 'checked_in' as const, name, record: inserted, counts: await counts() };
        });
        log.info('attendance_checkin', {
          activityId: activityId.toHexString(), staffId: staff.id.toHexString(), outcome: result.outcome,
          ...(result.created ? { attendanceId: result.created.toHexString() } : {}),
        });
        const word = statusWords[result.record.status];
        response.status(result.created ? 201 : 200).json({
          outcome: result.outcome,
          message: result.created ? `${result.name} · ${word}` : `${result.name} · Ya registrado · ${word}`,
          volunteer: { name: result.name },
          attendance: { status: result.record.status, checkInAt: result.record.checkInAt?.toISOString() ?? null },
          counts: result.counts,
        });
      } catch (error: unknown) {
        if (error instanceof HttpError) {
          const outcome = typeof error.body.outcome === 'string' ? error.body.outcome : `refused_${error.status}`;
          log.info('attendance_checkin', { activityId: activityId.toHexString(), staffId: staff.id.toHexString(), outcome });
        }
        throw error;
      }
    });
  });

  router.post('/:id/attendance/finalize', requireStaff(staffUsers, 'attendance.finalize'), async (request, response) => {
    const activityId = parseId(request.params.id);
    if (!activityId) { response.status(404).json(notFound); return; }
    const staff = currentStaff(response);
    const now = new Date();
    await answering(response, async () => {
      const result = await transaction(async (session) => {
        const before = await loadActivity(activityId, staff, 'attendance.finalize', session);
        // The same conditional stamp as a recording, plus closing the activity and marking it finalized,
        // all in one update so a second finalize no longer matches.
        const after = await activities.findOneAndUpdate(
          { _id: activityId, status: { $in: ['open', 'closed'] }, attendanceFinalizedAt: { $exists: false }, ...attendanceOpened(now) },
          { $set: { status: 'closed', attendanceFinalizedAt: now, attendanceFinalizedBy: staff.id, attendanceLock: new ObjectId(), updatedAt: now } },
          { session, returnDocument: 'after' },
        );
        if (!after) {
          throw conflict(before.attendanceFinalizedAt ? 'La asistencia de esta actividad ya estaba finalizada.' : lockRefusal(before, now));
        }
        const assigned = await assignments.find({ activityId, status: 'assigned' }, { session, projection: { _id: 1, volunteerId: 1 } }).toArray();
        if (!assigned.length) throw conflict('No hay voluntarios asignados, así que no hay asistencia que finalizar.');
        const records = await attendance.find({ assignmentId: { $in: assigned.map((entry) => entry._id) } }, { session }).toArray();
        const done = new Set(records.map((entry) => entry.assignmentId.toHexString()));
        const missing = assigned.filter((entry) => !done.has(entry._id.toHexString()));
        if (missing.length) {
          const people = await volunteers.find({ _id: { $in: missing.map((entry) => entry.volunteerId) } }, { session, projection: { firstName: 1, lastName: 1 } }).toArray();
          const names = new Map(people.map((person) => [person._id.toHexString(), person]));
          throw conflict(
            missing.length === 1 ? 'Falta registrar la asistencia de una persona.' : `Falta registrar la asistencia de ${missing.length} personas.`,
            {
              missing: missing.map((entry) => {
                const person = names.get(entry.volunteerId.toHexString());
                return { assignmentId: entry._id.toHexString(), firstName: person?.firstName ?? '', lastName: person?.lastName ?? '' };
              }),
            },
          );
        }
        const finalizedFields = { finalized: true, finalizedAt: now, finalizedBy: staff.id, updatedAt: now };
        await attendance.updateMany({ _id: { $in: records.map((record) => record._id) } }, { $set: finalizedFields }, { session });
        for (const record of records) {
          await writeAudit(collections, {
            actorId: staff.id, action: 'update', collection: 'attendance', recordId: record._id, before: record, after: { ...record, ...finalizedFields },
          }, session);
        }
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'activities', recordId: activityId, before, after }, session);
        return { activity: after, finalized: records.length };
      });
      log.info('attendance_finalized', { activityId: activityId.toHexString(), finalized: result.finalized, staffId: staff.id.toHexString() });
      response.json({ activity: publicActivity(result.activity), finalized: result.finalized });
    });
  });

  router.post('/:id/attendance/:assignmentId/correct', requireStaff(staffUsers, 'attendance.correctFinalized'), async (request, response) => {
    const activityId = parseId(request.params.id);
    const assignmentId = parseId(request.params.assignmentId);
    if (!activityId) { response.status(404).json(notFound); return; }
    if (!assignmentId) { response.status(404).json(assignmentNotFound); return; }
    if (!jsonBody(request, response)) return;
    const parsed = correctSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const { reason, ...input } = parsed.data;
    const staff = currentStaff(response);
    const now = new Date();
    await answering(response, async () => {
      const corrected = await transaction(async (session) => {
        const activity = await loadActivity(activityId, staff, 'attendance.correctFinalized', session);
        const stamped = await activities.updateOne(
          { _id: activityId, attendanceFinalizedAt: { $exists: true } }, { $set: { attendanceLock: new ObjectId() } }, { session },
        );
        const notFinalized = 'Esta asistencia todavía no está finalizada. Se cambia desde el registro normal.';
        if (!stamped.matchedCount) throw conflict(notFinalized);
        const assignment = await assignments.findOne({ _id: assignmentId, activityId }, { session });
        if (!assignment) throw new HttpError(404, assignmentNotFound);
        const before = await attendance.findOne({ assignmentId }, { session });
        if (!before?.finalized) throw conflict(notFinalized);
        const { set, unset } = valuesUpdate(attendanceValues(input, activity));
        const after = await attendance.findOneAndUpdate(
          { _id: before._id, finalized: true },
          {
            $set: { ...set, method: 'manual', correctionReason: reason, correctedAt: now, correctedBy: staff.id, updatedAt: now },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
          { session, returnDocument: 'after' },
        );
        if (!after) throw conflict(notFinalized);
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'attendance', recordId: after._id, before, after }, session);
        return after;
      });
      log.info('attendance_corrected', { attendanceId: corrected._id.toHexString(), activityId: activityId.toHexString(), staffId: staff.id.toHexString() });
      response.json({ attendance: publicAttendance(corrected) });
    });
  });

  return router;
}
