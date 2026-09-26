import { Router, type Request, type Response } from 'express';
import { ObjectId, type ClientSession, type Filter, type MongoClient } from 'mongodb';
import { z } from 'zod';
import { writeAudit } from './audit.js';
import type { Activity, Assignment, V2Collections } from './collections.js';
import { inTransaction, isDuplicate, parseId, searchPattern, searchWords } from './common.js';
import { log } from './logger.js';
import { currentStaff, requireStaff } from './session.js';

const PAGE_SIZE = 20;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const EARLIEST_START = new Date('2020-01-01T00:00:00Z');
const timeZone = 'America/Mexico_City';

// One Spanish message per field, describing the whole rule (zod's own messages never reach staff).
const fieldMessages = {
  name: 'Escribe el nombre de la actividad (de 3 a 120 caracteres).',
  location: 'Escribe el lugar (de 2 a 200 caracteres).',
  description: 'La descripción puede tener hasta 2000 caracteres.',
  requirements: 'Los requisitos pueden tener hasta 1000 caracteres.',
  startsAt: 'Elige un inicio entre 2020 y dentro de dos años.',
  endsAt: 'El fin debe ser después del inicio, y la actividad puede durar hasta 24 horas.',
  capacity: 'Escribe un cupo de 1 a 1000 personas.',
  supervisorId: 'Elige a alguien de la lista de supervisores activos.',
  status: 'Elige un estado válido.',
  volunteerId: 'Elige a un voluntario de la lista.',
  reason: 'Escribe el motivo (de 3 a 500 caracteres).',
} as const;
type Field = keyof typeof fieldMessages;

const noControlChars = /^[^\p{Cc}]*$/u;
const moment = z.iso.datetime({ offset: true });
const objectIdText = z.string().regex(/^[a-f0-9]{24}$/i);

function twoYearsFromNow(): Date {
  const limit = new Date();
  limit.setUTCFullYear(limit.getUTCFullYear() + 2);
  return limit;
}

// Optional fields accept '' so the form can clear them: omitted on create, removed on edit.
const cleared = z.literal('');
const activityFields = {
  name: z.string().trim().min(3).max(120).regex(noControlChars),
  location: z.string().trim().min(2).max(200).regex(noControlChars),
  description: z.string().trim().max(2000).optional(),
  requirements: z.string().trim().max(1000).optional(),
  startsAt: moment.refine((value) => {
    const date = new Date(value);
    return date >= EARLIEST_START && date <= twoYearsFromNow();
  }),
  endsAt: moment,
  capacity: z.number().int().min(1).max(1000),
  supervisorId: z.union([cleared, objectIdText]).optional(),
};

const createSchema = z.strictObject(activityFields);
const editSchema = z.strictObject(activityFields).partial();
const statusSchema = z.strictObject({ status: z.enum(['draft', 'open', 'closed', 'cancelled']) });
const assignSchema = z.strictObject({ volunteerId: objectIdText });
const cancelSchema = z.strictObject({ reason: z.string().trim().min(3).max(500).regex(noControlChars) });
const listSchema = z.object({
  when: z.enum(['upcoming', 'past', 'cancelled', 'all']).default('upcoming'),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

type EditInput = z.infer<typeof editSchema>;
type Status = Activity['status'];

// Thrown inside a transaction to abort it and answer with a plain message.
class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: Record<string, unknown>) { super('http'); }
}
const conflict = (message: string, extra: Record<string, unknown> = {}) => new HttpError(409, { message, ...extra });

function fieldError(fields: Partial<Record<Field, string>>) {
  return new HttpError(400, { message: 'Revisa los campos marcados.', fields });
}

function invalid(response: Response, error: z.ZodError) {
  const fields: Partial<Record<Field, string>> = {};
  let unknownField = false;
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') unknownField = true;
    const key = issue.path[0];
    if (typeof key === 'string' && key in fieldMessages) fields[key as Field] = fieldMessages[key as Field];
  }
  const message = unknownField && !Object.keys(fields).length
    ? 'Se enviaron datos que no se pueden guardar.'
    : 'Revisa los campos marcados.';
  response.status(400).json({ message, fields });
}

const notFound = { message: 'No encontramos esa actividad. Puede que el enlace ya no sea válido.' };
const volunteerNotFound = { message: 'No encontramos a ese voluntario. Actualiza la lista e inténtalo de nuevo.' };
const assignmentNotFound = { message: 'No encontramos esa asignación. Actualiza la actividad e inténtalo de nuevo.' };
const unreadable = { message: 'No pudimos leer los datos enviados.' };

function timeError(startsAt: Date, endsAt: Date): string | null {
  const length = endsAt.getTime() - startsAt.getTime();
  return length > 0 && length <= MAX_DURATION_MS ? null : fieldMessages.endsAt;
}

function formatMoment(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

// Explicit fields so nothing unexpected is ever sent to the app.
function publicActivity(activity: Activity) {
  return {
    id: activity._id.toHexString(),
    name: activity.name,
    description: activity.description ?? null,
    location: activity.location,
    startsAt: activity.startsAt.toISOString(),
    endsAt: activity.endsAt.toISOString(),
    capacity: activity.capacity,
    assignedCount: activity.assignedCount,
    requirements: activity.requirements ?? null,
    status: activity.status,
    supervisorId: activity.supervisorId?.toHexString() ?? null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

function publicAssignment(assignment: Assignment) {
  return {
    id: assignment._id.toHexString(),
    volunteerId: assignment.volunteerId.toHexString(),
    activityId: assignment.activityId.toHexString(),
    status: assignment.status,
    cancelledReason: assignment.cancelledReason ?? null,
  };
}

function listQuery(when: 'upcoming' | 'past' | 'cancelled' | 'all', q: string | undefined) {
  const now = new Date();
  const live: Status[] = ['draft', 'open'];
  let filter: Filter<Activity>;
  if (when === 'upcoming') filter = { status: { $in: live }, endsAt: { $gt: now } };
  else if (when === 'past') filter = { $or: [{ status: 'closed' }, { status: { $in: live }, endsAt: { $lte: now } }] };
  else if (when === 'cancelled') filter = { status: 'cancelled' };
  else filter = {};
  const words = searchWords(q);
  if (words.length) filter = { $and: [filter, ...words.map((word) => ({ name: searchPattern(word) }))] };
  const direction = when === 'upcoming' ? 1 : -1;
  return { filter, sort: { startsAt: direction, _id: direction } as const };
}

// Which statuses an activity may move from to reach each status. Closed and cancelled are final.
const allowedFrom: Record<Status, Status[]> = {
  draft: ['open'],
  open: ['draft'],
  closed: ['open'],
  cancelled: ['draft', 'open'],
};

function statusRefusal(from: Status, to: Status, assignedCount: number): string {
  if (from === to) return 'La actividad ya tiene ese estado.';
  if (from === 'closed' || from === 'cancelled') return 'Esta actividad ya está cerrada o cancelada y no se puede cambiar.';
  if (to === 'draft' && assignedCount > 0) return 'No puedes regresar a borrador una actividad con voluntarios asignados. Cancela sus asignaciones primero.';
  if (to === 'closed') return 'Solo puedes cerrar una actividad publicada.';
  return 'Ese cambio de estado no está permitido.';
}

interface OverlapRow {
  volunteerId: ObjectId;
  activity: { _id: ObjectId; name: string; startsAt: Date };
  volunteer?: { firstName: string; lastName: string };
}

export function activitiesRouter(collections: V2Collections, client: MongoClient) {
  const { staffUsers, volunteers, activities, assignments } = collections;
  const router = Router();
  const transaction = <T>(work: (session: ClientSession) => Promise<T>) => inTransaction(client, work);

  // Runs a handler that may throw HttpError (usually from inside a transaction) and answers with it.
  async function answering(response: Response, work: () => Promise<void>) {
    try {
      await work();
    } catch (error: unknown) {
      if (error instanceof HttpError) { response.status(error.status).json(error.body); return; }
      throw error;
    }
  }

  function jsonBody(request: Request, response: Response): boolean {
    if (request.is('application/json')) return true;
    response.status(400).json(unreadable);
    return false;
  }

  async function checkSupervisor(id: string | undefined): Promise<ObjectId | undefined> {
    if (!id) return undefined;
    const supervisor = await staffUsers.findOne({ _id: new ObjectId(id), active: true, role: 'supervisor' }, { projection: { _id: 1 } });
    if (!supervisor) throw fieldError({ supervisorId: fieldMessages.supervisorId });
    return supervisor._id;
  }

  // The assigned activities of these volunteers (other than `excludeId`) that overlap [startsAt, endsAt).
  // Back to back is fine; cancelled activities never count.
  function overlaps(volunteerIds: ObjectId[], excludeId: ObjectId, startsAt: Date, endsAt: Date, session: ClientSession, withNames: boolean) {
    return assignments.aggregate<OverlapRow>([
      { $match: { volunteerId: { $in: volunteerIds }, status: 'assigned', activityId: { $ne: excludeId } } },
      { $lookup: {
        from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity',
        pipeline: [
          { $match: { status: { $ne: 'cancelled' }, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } } },
          { $project: { name: 1, startsAt: 1 } },
        ],
      } },
      { $unwind: '$activity' },
      ...(withNames ? [
        { $lookup: { from: 'volunteers', localField: 'volunteerId', foreignField: '_id', as: 'volunteer', pipeline: [{ $project: { firstName: 1, lastName: 1 } }] } },
        { $unwind: '$volunteer' },
      ] : []),
      { $sort: { 'activity.startsAt': 1 } },
      { $project: { volunteerId: 1, activity: 1, volunteer: 1 } },
    ], { session }).toArray();
  }

  router.get('/', requireStaff(staffUsers, 'activities.read'), async (request, response) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ message: 'La búsqueda no es válida. Revisa el texto e inténtalo de nuevo.' });
      return;
    }
    const { when, q, page } = parsed.data;
    const { filter, sort } = listQuery(when, q);
    const found = await activities.find(filter, {
      projection: { name: 1, location: 1, startsAt: 1, endsAt: 1, capacity: 1, assignedCount: 1, status: 1 },
      sort,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE + 1,
    }).toArray();
    response.json({
      activities: found.slice(0, PAGE_SIZE).map((activity) => ({
        id: activity._id.toHexString(),
        name: activity.name,
        location: activity.location,
        startsAt: activity.startsAt.toISOString(),
        endsAt: activity.endsAt.toISOString(),
        capacity: activity.capacity,
        assignedCount: activity.assignedCount,
        status: activity.status,
      })),
      page,
      hasMore: found.length > PAGE_SIZE,
    });
  });

  router.post('/', requireStaff(staffUsers, 'activities.write'), async (request, response) => {
    if (!jsonBody(request, response)) return;
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const input = parsed.data;
    const staff = currentStaff(response);
    await answering(response, async () => {
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      const badTime = timeError(startsAt, endsAt);
      if (badTime) throw fieldError({ endsAt: badTime });
      const supervisorId = await checkSupervisor(input.supervisorId);
      const now = new Date();
      const activity: Activity = {
        _id: new ObjectId(),
        name: input.name,
        location: input.location,
        startsAt,
        endsAt,
        capacity: input.capacity,
        assignedCount: 0,
        ...(input.description ? { description: input.description } : {}),
        ...(input.requirements ? { requirements: input.requirements } : {}),
        ...(supervisorId ? { supervisorId } : {}),
        status: 'draft',
        createdBy: staff.id,
        createdAt: now,
        updatedAt: now,
      };
      await transaction(async (session) => {
        await activities.insertOne(activity, { session });
        await writeAudit(collections, { actorId: staff.id, action: 'insert', collection: 'activities', recordId: activity._id, after: activity }, session);
      });
      log.info('activity_created', { activityId: activity._id.toHexString(), staffId: staff.id.toHexString() });
      response.status(201).json({ activity: publicActivity(activity) });
    });
  });

  router.get('/:id', requireStaff(staffUsers, 'activities.read'), async (request, response) => {
    const id = parseId(request.params.id);
    const activity = id ? await activities.findOne({ _id: id }) : null;
    if (!id || !activity) { response.status(404).json(notFound); return; }
    const supervisor = activity.supervisorId
      ? await staffUsers.findOne({ _id: activity.supervisorId }, { projection: { fullName: 1 } })
      : null;
    const participants = await assignments.aggregate<{
      _id: ObjectId; volunteerId: ObjectId; status: 'assigned' | 'cancelled'; cancelledReason?: string;
      volunteer: { firstName: string; lastName: string; phone: string };
    }>([
      { $match: { activityId: id } },
      { $lookup: { from: 'volunteers', localField: 'volunteerId', foreignField: '_id', as: 'volunteer', pipeline: [{ $project: { firstName: 1, lastName: 1, phone: 1 } }] } },
      { $unwind: '$volunteer' },
      // 'assigned' sorts before 'cancelled', so assigned people come first.
      { $sort: { status: 1, 'volunteer.lastName': 1, 'volunteer.firstName': 1, _id: 1 } },
      { $project: { volunteerId: 1, status: 1, cancelledReason: 1, volunteer: 1 } },
    ], { collation: { locale: 'es', strength: 1 } }).toArray();
    response.json({
      activity: publicActivity(activity),
      supervisor: supervisor ? { id: supervisor._id.toHexString(), fullName: supervisor.fullName } : null,
      participants: participants.map((entry) => ({
        assignmentId: entry._id.toHexString(),
        volunteerId: entry.volunteerId.toHexString(),
        firstName: entry.volunteer.firstName,
        lastName: entry.volunteer.lastName,
        phone: entry.volunteer.phone,
        status: entry.status,
        cancelledReason: entry.cancelledReason ?? null,
      })),
    });
  });

  router.patch('/:id', requireStaff(staffUsers, 'activities.write'), async (request, response) => {
    const id = parseId(request.params.id);
    if (!id) { response.status(404).json(notFound); return; }
    if (!jsonBody(request, response)) return;
    const parsed = editSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const input = parsed.data;
    const staff = currentStaff(response);
    await answering(response, async () => {
      const { set, unset } = editUpdate(input);
      if (input.supervisorId) set.supervisorId = await checkSupervisor(input.supervisorId);
      if (!Object.keys(set).length && !Object.keys(unset).length) throw new HttpError(400, { message: 'No hay cambios para guardar.' });

      const updated = await transaction(async (session) => {
        const before = await activities.findOne({ _id: id }, { session });
        if (!before) throw new HttpError(404, notFound);
        if (before.status !== 'draft' && before.status !== 'open') throw conflict('Solo puedes editar actividades en borrador o publicadas.');
        if (set.capacity !== undefined && set.capacity < before.assignedCount) {
          throw conflict(`Ya hay ${before.assignedCount} personas asignadas. El cupo no puede ser menor.`, { fields: { capacity: `Debe ser de al menos ${before.assignedCount}.` } });
        }
        const startsAt = set.startsAt ?? before.startsAt;
        const endsAt = set.endsAt ?? before.endsAt;
        const timesChanged = startsAt.getTime() !== before.startsAt.getTime() || endsAt.getTime() !== before.endsAt.getTime();
        if (timesChanged) {
          const badTime = timeError(startsAt, endsAt);
          if (badTime) throw fieldError({ endsAt: badTime });
          if (before.assignedCount > 0) await checkDateEdit(id, startsAt, endsAt, session);
        }
        // The filter repeats the checks, so an edit racing an assignment can't slip past them.
        const after = await activities.findOneAndUpdate(
          { _id: id, status: { $in: ['draft', 'open'] }, ...(set.capacity !== undefined ? { assignedCount: { $lte: set.capacity } } : {}) },
          { $set: { ...set, updatedAt: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
          { session, returnDocument: 'after' },
        );
        if (!after) throw conflict('La actividad cambió mientras la editabas. Actualízala e inténtalo de nuevo.');
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'activities', recordId: id, before, after }, session);
        return after;
      });
      log.info('activity_updated', { activityId: id.toHexString(), staffId: staff.id.toHexString() });
      response.json({ activity: publicActivity(updated) });
    });
  });

  // Moving an activity with people assigned must not double book any of them. Stamping each person's
  // lock first makes this collide with a concurrent assignment of one of them elsewhere.
  async function checkDateEdit(id: ObjectId, startsAt: Date, endsAt: Date, session: ClientSession) {
    const assigned = await assignments.find({ activityId: id, status: 'assigned' }, { session, projection: { volunteerId: 1 } }).toArray();
    const volunteerIds = assigned.map((entry) => entry.volunteerId);
    if (!volunteerIds.length) return;
    await volunteers.updateMany({ _id: { $in: volunteerIds } }, { $set: { assignmentLock: new ObjectId() } }, { session });
    const found = await overlaps(volunteerIds, id, startsAt, endsAt, session, true);
    if (!found.length) return;
    const people = new Set(found.map((row) => row.volunteerId.toHexString())).size;
    throw conflict(
      people === 1
        ? 'Con el nuevo horario, una persona asignada quedaría en dos actividades a la vez.'
        : `Con el nuevo horario, ${people} personas asignadas quedarían en dos actividades a la vez.`,
      {
        conflicts: found.map((row) => ({
          volunteerId: row.volunteerId.toHexString(),
          volunteerName: row.volunteer ? `${row.volunteer.firstName} ${row.volunteer.lastName}` : '',
          activityId: row.activity._id.toHexString(),
          activityName: row.activity.name,
        })),
      },
    );
  }

  router.post('/:id/status', requireStaff(staffUsers, 'activities.write'), async (request, response) => {
    const id = parseId(request.params.id);
    if (!id) { response.status(404).json(notFound); return; }
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const { status } = parsed.data;
    const staff = currentStaff(response);
    await answering(response, async () => {
      const updated = await transaction(async (session) => {
        const before = await activities.findOne({ _id: id }, { session });
        if (!before) throw new HttpError(404, notFound);
        const after = await activities.findOneAndUpdate(
          { _id: id, status: { $in: allowedFrom[status] }, ...(status === 'draft' ? { assignedCount: 0 } : {}) },
          { $set: { status, updatedAt: new Date() } },
          { session, returnDocument: 'after' },
        );
        if (!after) throw conflict(statusRefusal(before.status, status, before.assignedCount));
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'activities', recordId: id, before, after }, session);
        return after;
      });
      log.info('activity_status_changed', { activityId: id.toHexString(), status, staffId: staff.id.toHexString() });
      response.json({ activity: publicActivity(updated) });
    });
  });

  router.post('/:id/assignments', requireStaff(staffUsers, 'assignments.write'), async (request, response) => {
    const activityId = parseId(request.params.id);
    if (!activityId) { response.status(404).json(notFound); return; }
    if (!jsonBody(request, response)) return;
    const parsed = assignSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const volunteerId = new ObjectId(parsed.data.volunteerId);
    const staff = currentStaff(response);
    await answering(response, async () => {
      let result: { assignment: Assignment; created: boolean };
      try {
        result = await transaction((session) => assign(activityId, volunteerId, staff.id, session));
      } catch (error: unknown) {
        // Safety net: the pair is unique, so a lost race on the insert is the same "already assigned".
        if (isDuplicate(error)) throw conflict('Esta persona ya está asignada a esta actividad.');
        throw error;
      }
      const { assignment, created } = result;
      log.info(created ? 'assignment_created' : 'assignment_reactivated', {
        assignmentId: assignment._id.toHexString(), activityId: activityId.toHexString(), staffId: staff.id.toHexString(),
      });
      response.status(created ? 201 : 200).json({ assignment: publicAssignment(assignment) });
    });
  });

  // Every step writes the activity (the counter) and the volunteer (the lock), so two assignments that
  // compete for a place or for the same person hit a write conflict and withTransaction retries the loser.
  async function assign(activityId: ObjectId, volunteerId: ObjectId, staffId: ObjectId, session: ClientSession) {
    const activity = await activities.findOne({ _id: activityId }, { session });
    if (!activity) throw new HttpError(404, notFound);
    const volunteer = await volunteers.findOne({ _id: volunteerId }, { session, projection: { status: 1 } });
    if (!volunteer) throw new HttpError(404, volunteerNotFound);
    if (volunteer.status !== 'active') throw conflict('Esta persona está inactiva. Reactívala antes de asignarla.');
    const existing = await assignments.findOne({ volunteerId, activityId }, { session });
    if (existing?.status === 'assigned') throw conflict('Esta persona ya está asignada a esta actividad.');

    const counted = await activities.updateOne(
      { _id: activityId, status: 'open', $expr: { $lt: ['$assignedCount', '$capacity'] } },
      { $inc: { assignedCount: 1 } },
      { session },
    );
    if (!counted.matchedCount) {
      throw conflict(activity.status !== 'open'
        ? 'Solo puedes asignar voluntarios a una actividad publicada.'
        : 'La actividad ya está llena. Aumenta el cupo o cancela otra asignación.');
    }

    await volunteers.updateOne({ _id: volunteerId }, { $set: { assignmentLock: new ObjectId() } }, { session });
    const [clash] = await overlaps([volunteerId], activityId, activity.startsAt, activity.endsAt, session, false);
    if (clash) {
      throw conflict(`Esta persona ya está asignada a «${clash.activity.name}» el ${formatMoment(clash.activity.startsAt)}, que se cruza con este horario.`);
    }

    const now = new Date();
    if (existing) {
      const after = await assignments.findOneAndUpdate(
        { _id: existing._id, status: 'cancelled' },
        { $set: { status: 'assigned', assignedBy: staffId, updatedAt: now }, $unset: { cancelledReason: '', cancelledAt: '', cancelledBy: '' } },
        { session, returnDocument: 'after' },
      );
      if (!after) throw conflict('Esta persona ya está asignada a esta actividad.');
      await writeAudit(collections, { actorId: staffId, action: 'update', collection: 'assignments', recordId: after._id, before: existing, after }, session);
      return { assignment: after, created: false };
    }
    const assignment: Assignment = {
      _id: new ObjectId(), volunteerId, activityId, assignedBy: staffId, status: 'assigned', createdAt: now, updatedAt: now,
    };
    await assignments.insertOne(assignment, { session });
    await writeAudit(collections, { actorId: staffId, action: 'insert', collection: 'assignments', recordId: assignment._id, after: assignment }, session);
    return { assignment, created: true };
  }

  router.post('/:id/assignments/:assignmentId/cancel', requireStaff(staffUsers, 'assignments.write'), async (request, response) => {
    const activityId = parseId(request.params.id);
    const assignmentId = parseId(request.params.assignmentId);
    if (!activityId) { response.status(404).json(notFound); return; }
    if (!assignmentId) { response.status(404).json(assignmentNotFound); return; }
    if (!jsonBody(request, response)) return;
    const parsed = cancelSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const { reason } = parsed.data;
    const staff = currentStaff(response);
    await answering(response, async () => {
      const cancelled = await transaction(async (session) => {
        const activity = await activities.findOne({ _id: activityId }, { session, projection: { status: 1 } });
        if (!activity) throw new HttpError(404, notFound);
        const before = await assignments.findOne({ _id: assignmentId, activityId }, { session });
        if (!before) throw new HttpError(404, assignmentNotFound);
        if (before.status === 'cancelled') throw conflict('Esta asignación ya estaba cancelada.');
        const counted = await activities.updateOne(
          { _id: activityId, status: 'open', assignedCount: { $gt: 0 } }, { $inc: { assignedCount: -1 } }, { session },
        );
        if (!counted.matchedCount) throw conflict('Solo puedes cancelar asignaciones de una actividad publicada.');
        const now = new Date();
        const after = await assignments.findOneAndUpdate(
          { _id: assignmentId, status: 'assigned' },
          { $set: { status: 'cancelled', cancelledReason: reason, cancelledAt: now, cancelledBy: staff.id, updatedAt: now } },
          { session, returnDocument: 'after' },
        );
        if (!after) throw conflict('Esta asignación ya estaba cancelada.');
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'assignments', recordId: assignmentId, before, after }, session);
        return after;
      });
      log.info('assignment_cancelled', { assignmentId: assignmentId.toHexString(), activityId: activityId.toHexString(), staffId: staff.id.toHexString() });
      response.json({ assignment: publicAssignment(cancelled) });
    });
  });

  return router;
}

// Splits an edit into fields to set and optional fields to remove (sent as '').
function editUpdate(input: EditInput) {
  const set: Partial<Activity> = {};
  const unset: Partial<Record<'description' | 'requirements' | 'supervisorId', ''>> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.location !== undefined) set.location = input.location;
  if (input.startsAt !== undefined) set.startsAt = new Date(input.startsAt);
  if (input.endsAt !== undefined) set.endsAt = new Date(input.endsAt);
  if (input.capacity !== undefined) set.capacity = input.capacity;
  if (input.description !== undefined) { if (input.description) set.description = input.description; else unset.description = ''; }
  if (input.requirements !== undefined) { if (input.requirements) set.requirements = input.requirements; else unset.requirements = ''; }
  if (input.supervisorId === '') unset.supervisorId = '';
  return { set, unset };
}
