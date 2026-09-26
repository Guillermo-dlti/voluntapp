import { Router, type Response } from 'express';
import { ObjectId, type Filter, type MongoClient } from 'mongodb';
import { z } from 'zod';
import { writeAudit } from './audit.js';
import type { V2Collections, Volunteer } from './collections.js';
import { inTransaction, isDuplicate, parseId, searchPattern, searchWords } from './common.js';
import { log } from './logger.js';
import { currentStaff, requireStaff } from './session.js';

const PAGE_SIZE = 20;
const timeZone = 'America/Mexico_City';

// One Spanish message per field, describing the whole rule. zod's own messages are English and
// technical, so they never reach staff.
const fieldMessages = {
  firstName: 'Escribe el nombre (hasta 60 caracteres).',
  lastName: 'Escribe los apellidos (hasta 80 caracteres).',
  phone: 'Escribe un teléfono válido de 10 dígitos.',
  email: 'Escribe un correo válido, por ejemplo nombre@correo.com.',
  birthDate: 'Elige una fecha de nacimiento pasada, posterior a 1900.',
  emergencyContactName: 'Escribe el nombre del contacto de emergencia (hasta 100 caracteres).',
  emergencyContactPhone: 'Escribe un teléfono válido de 10 dígitos para el contacto de emergencia.',
  notes: 'Las notas pueden tener hasta 1000 caracteres.',
  status: 'Elige si la persona está activa o inactiva.',
} as const;
type Field = keyof typeof fieldMessages;

const noControlChars = /^[^\p{Cc}]*$/u;
const name = (max: number) => z.string().trim().min(1).max(max).regex(noControlChars);
// Stored in international format; the app adds +52 to a 10-digit Mexican number before sending.
const phone = z.string().trim().regex(/^\+[1-9]\d{7,14}$/);
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

function todayInMexico(): string {
  // en-CA formats as YYYY-MM-DD, which compares correctly as a string.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const birthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates such as 2001-02-30, which Date would silently roll over.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    && value > '1900-01-01' && value < todayInMexico();
});

// Optional fields accept '' so the form can clear them: omitted on create, removed on edit.
const cleared = z.literal('');
const volunteerFields = {
  firstName: name(60),
  lastName: name(80),
  phone,
  emergencyContactName: name(100),
  emergencyContactPhone: phone,
  email: z.union([cleared, email]).optional(),
  birthDate: z.union([cleared, birthDate]).optional(),
  notes: z.string().trim().max(1000).optional(),
};

const createSchema = z.strictObject(volunteerFields);
const editSchema = z.strictObject(volunteerFields).partial();
const statusSchema = z.strictObject({ status: z.enum(['active', 'inactive']) });
const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

type EditInput = z.infer<typeof editSchema>;

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

const notFound = { message: 'No encontramos a ese voluntario. Puede que el enlace ya no sea válido.' };
const duplicateEmail = { message: 'Ya hay un voluntario registrado con ese correo.', fields: { email: 'Este correo ya está registrado con otro voluntario.' } };

// Explicit fields so nothing unexpected is ever sent to the app.
function publicVolunteer(volunteer: Volunteer) {
  return {
    id: volunteer._id.toHexString(),
    firstName: volunteer.firstName,
    lastName: volunteer.lastName,
    phone: volunteer.phone,
    email: volunteer.email ?? null,
    birthDate: volunteer.birthDate ? volunteer.birthDate.toISOString().slice(0, 10) : null,
    emergencyContactName: volunteer.emergencyContactName,
    emergencyContactPhone: volunteer.emergencyContactPhone,
    status: volunteer.status,
    notes: volunteer.notes ?? null,
    createdAt: volunteer.createdAt.toISOString(),
    updatedAt: volunteer.updatedAt.toISOString(),
  };
}

function listFilter(q: string | undefined, status: 'active' | 'inactive' | 'all'): Filter<Volunteer> {
  const filter: Filter<Volunteer> = status === 'all' ? {} : { status };
  const words = searchWords(q);
  if (!words.length) return filter;
  // Every word has to match some field, so "ana lopez" finds Ana López.
  filter.$and = words.map((word) => {
    const pattern = searchPattern(word);
    return { $or: [{ firstName: pattern }, { lastName: pattern }, { email: pattern }, { phone: pattern }] };
  });
  return filter;
}

export function volunteersRouter(collections: V2Collections, client: MongoClient) {
  const { staffUsers, volunteers, assignments } = collections;
  const router = Router();

  const transaction = <T>(work: Parameters<typeof inTransaction<T>>[1]) => inTransaction(client, work);

  router.get('/', requireStaff(staffUsers, 'volunteers.read'), async (request, response) => {
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ message: 'La búsqueda no es válida. Revisa el texto e inténtalo de nuevo.' });
      return;
    }
    const { q, status, page } = parsed.data;
    const found = await volunteers.find(listFilter(q, status), {
      projection: { firstName: 1, lastName: 1, phone: 1, email: 1, status: 1 },
      sort: { lastName: 1, firstName: 1, _id: 1 },
      collation: { locale: 'es', strength: 1 },
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE + 1,
    }).toArray();
    response.json({
      volunteers: found.slice(0, PAGE_SIZE).map((volunteer) => ({
        id: volunteer._id.toHexString(),
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        phone: volunteer.phone,
        email: volunteer.email ?? null,
        status: volunteer.status,
      })),
      page,
      hasMore: found.length > PAGE_SIZE,
    });
  });

  router.post('/', requireStaff(staffUsers, 'volunteers.write'), async (request, response) => {
    if (!request.is('application/json')) { response.status(400).json({ message: 'No pudimos leer los datos enviados.' }); return; }
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const staff = currentStaff(response);
    const input = parsed.data;
    const now = new Date();
    const volunteer: Volunteer = {
      _id: new ObjectId(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      ...(input.email ? { email: input.email } : {}),
      ...(input.birthDate ? { birthDate: new Date(`${input.birthDate}T00:00:00Z`) } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      status: 'active',
      createdBy: staff.id,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await transaction(async (session) => {
        await volunteers.insertOne(volunteer, { session });
        await writeAudit(collections, { actorId: staff.id, action: 'insert', collection: 'volunteers', recordId: volunteer._id, after: volunteer }, session);
      });
    } catch (error: unknown) {
      if (isDuplicate(error)) { response.status(409).json(duplicateEmail); return; }
      throw error;
    }
    log.info('volunteer_created', { volunteerId: volunteer._id.toHexString(), staffId: staff.id.toHexString() });
    response.status(201).json({ volunteer: publicVolunteer(volunteer) });
  });

  router.get('/:id', requireStaff(staffUsers, 'volunteers.read'), async (request, response) => {
    const id = parseId(request.params.id);
    const volunteer = id ? await volunteers.findOne({ _id: id }) : null;
    if (!id || !volunteer) { response.status(404).json(notFound); return; }

    const history = await assignments.aggregate<{
      _id: ObjectId; status: 'assigned' | 'cancelled';
      activity: { _id: ObjectId; name: string; startsAt: Date; endsAt: Date; status: string };
      attendance?: { status: 'present' | 'absent' | 'late'; hours: number; finalized: boolean };
    }>([
      { $match: { volunteerId: id } },
      { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
      { $unwind: '$activity' },
      { $lookup: { from: 'attendance', localField: '_id', foreignField: 'assignmentId', as: 'attendance' } },
      { $unwind: { path: '$attendance', preserveNullAndEmptyArrays: true } },
      { $sort: { 'activity.startsAt': -1 } },
      { $limit: 100 },
      { $project: {
        status: 1,
        activity: { _id: 1, name: 1, startsAt: 1, endsAt: 1, status: 1 },
        attendance: { status: 1, hours: 1, finalized: 1 },
      } },
    ]).toArray();

    // Totals come only from finalized attendance and are never stored, so they can't drift.
    const [totals] = await assignments.aggregate<{ hours: number; completed: number }>([
      { $match: { volunteerId: id } },
      { $lookup: { from: 'attendance', localField: '_id', foreignField: 'assignmentId', as: 'attendance' } },
      { $unwind: '$attendance' },
      { $match: { 'attendance.finalized': true } },
      { $group: {
        _id: null,
        hours: { $sum: '$attendance.hours' },
        completed: { $sum: { $cond: [{ $in: ['$attendance.status', ['present', 'late']] }, 1, 0] } },
      } },
    ]).toArray();

    response.json({
      volunteer: publicVolunteer(volunteer),
      history: history.map((entry) => ({
        assignmentId: entry._id.toHexString(),
        assignmentStatus: entry.status,
        activity: {
          id: entry.activity._id.toHexString(),
          name: entry.activity.name,
          startsAt: entry.activity.startsAt.toISOString(),
          endsAt: entry.activity.endsAt.toISOString(),
          status: entry.activity.status,
        },
        attendance: entry.attendance
          ? { status: entry.attendance.status, hours: entry.attendance.hours, finalized: entry.attendance.finalized }
          : null,
      })),
      totalHours: Math.round((totals?.hours ?? 0) * 100) / 100,
      completedActivities: totals?.completed ?? 0,
    });
  });

  router.patch('/:id', requireStaff(staffUsers, 'volunteers.write'), async (request, response) => {
    const id = parseId(request.params.id);
    if (!id) { response.status(404).json(notFound); return; }
    if (!request.is('application/json')) { response.status(400).json({ message: 'No pudimos leer los datos enviados.' }); return; }
    const parsed = editSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const { set, unset } = editUpdate(parsed.data);
    if (!Object.keys(set).length && !Object.keys(unset).length) {
      response.status(400).json({ message: 'No hay cambios para guardar.' });
      return;
    }
    const staff = currentStaff(response);
    let updated: Volunteer | null = null;
    try {
      updated = await transaction(async (session) => {
        const before = await volunteers.findOne({ _id: id }, { session });
        if (!before) return null;
        const after = await volunteers.findOneAndUpdate(
          { _id: id },
          { $set: { ...set, updatedAt: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
          { session, returnDocument: 'after' },
        );
        await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'volunteers', recordId: id, before, after }, session);
        return after;
      });
    } catch (error: unknown) {
      if (isDuplicate(error)) { response.status(409).json(duplicateEmail); return; }
      throw error;
    }
    if (!updated) { response.status(404).json(notFound); return; }
    log.info('volunteer_updated', { volunteerId: id.toHexString(), staffId: staff.id.toHexString() });
    response.json({ volunteer: publicVolunteer(updated) });
  });

  router.post('/:id/status', requireStaff(staffUsers, 'volunteers.write'), async (request, response) => {
    const id = parseId(request.params.id);
    if (!id) { response.status(404).json(notFound); return; }
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) { invalid(response, parsed.error); return; }
    const { status } = parsed.data;
    const staff = currentStaff(response);
    const result = await transaction(async (session) => {
      const before = await volunteers.findOne({ _id: id }, { session });
      if (!before || before.status === status) return before;
      const after = await volunteers.findOneAndUpdate(
        { _id: id }, { $set: { status, updatedAt: new Date() } }, { session, returnDocument: 'after' },
      );
      await writeAudit(collections, { actorId: staff.id, action: 'update', collection: 'volunteers', recordId: id, before, after }, session);
      return after;
    });
    if (!result) { response.status(404).json(notFound); return; }
    log.info('volunteer_status_changed', { volunteerId: id.toHexString(), status, staffId: staff.id.toHexString() });
    response.json({ volunteer: publicVolunteer(result) });
  });

  return router;
}

// Splits an edit into fields to set and optional fields to remove (sent as '').
function editUpdate(input: EditInput) {
  const set: Partial<Volunteer> = {};
  const unset: Partial<Record<'email' | 'birthDate' | 'notes', ''>> = {};
  if (input.firstName !== undefined) set.firstName = input.firstName;
  if (input.lastName !== undefined) set.lastName = input.lastName;
  if (input.phone !== undefined) set.phone = input.phone;
  if (input.emergencyContactName !== undefined) set.emergencyContactName = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) set.emergencyContactPhone = input.emergencyContactPhone;
  if (input.email !== undefined) { if (input.email) set.email = input.email; else unset.email = ''; }
  if (input.birthDate !== undefined) {
    if (input.birthDate) set.birthDate = new Date(`${input.birthDate}T00:00:00Z`); else unset.birthDate = '';
  }
  if (input.notes !== undefined) { if (input.notes) set.notes = input.notes; else unset.notes = ''; }
  return { set, unset };
}
