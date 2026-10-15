import { writeFile } from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import QRCode from 'qrcode';
import { writeAudit } from './audit.js';
import { newCheckinToken } from './checkin-token.js';
import type { Activity, Assignment, V2Collections, Volunteer } from './collections.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';

// Sets up the QR check in demo. NOT destructive: it creates (or reuses) one activity, "Demo · Escaneo de
// QR", starting in 10 minutes with attendance already started and supervised by supervisor@bamx.test,
// assigns 4 active volunteers to it, and writes server/demo-qr.html with their QRs plus one active
// volunteer who isn't assigned and one well formed code that belongs to nobody.
//
// It writes straight to the collections (like seed-demo.ts), so it repeats the rules the API enforces:
// only active volunteers, no overlapping assignments, assignedCount kept in step, an audit entry per write.
//   npm run server:seed:qr

const DEMO_NAME = 'Demo · Escaneo de QR';
const ASSIGNED = 4;
const OUTPUT = new URL('../demo-qr.html', import.meta.url);

type DemoVolunteer = Pick<Volunteer, '_id' | 'firstName' | 'lastName' | 'checkinToken'>;

// A problem the person running the seed can fix; its message is shown as is.
class SeedError extends Error {}

async function seedQrDemo() {
  const config = loadConfig();
  const { client, collections } = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB);
  const { staffUsers, volunteers, activities, assignments } = collections;
  try {
    const staff = async (email: string) => {
      const found = await staffUsers.findOne({ email, active: true }, { projection: { _id: 1 } });
      if (!found) throw new SeedError(`Falta la cuenta ${email}; corre primero npm run server:seed.`);
      return found._id;
    };
    const coordinator = await staff('coordinador@bamx.test');
    const supervisor = await staff('supervisor@bamx.test');

    const now = new Date();
    const startsAt = new Date(Math.ceil((now.getTime() + 10 * 60_000) / 60_000) * 60_000);
    const endsAt = new Date(startsAt.getTime() + 3 * 3_600_000);

    // Volunteers already assigned to something in the demo window, other than `activityId`.
    const busyIn = async (activityId: ObjectId | null) => {
      const clashing = await activities.find(
        { ...(activityId ? { _id: { $ne: activityId } } : {}), status: { $ne: 'cancelled' }, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } },
        { projection: { _id: 1 } },
      ).toArray();
      const ids = await assignments.distinct('volunteerId', { activityId: { $in: clashing.map((entry) => entry._id) }, status: 'assigned' });
      return new Set(ids.map((id) => id.toHexString()));
    };

    const activity = await reusableDemo(collections, busyIn);
    let activityId: ObjectId;
    if (activity) {
      activityId = activity._id;
      const after: Activity = {
        ...activity, startsAt, endsAt, status: 'open', supervisorId: supervisor,
        attendanceStartedAt: now, attendanceStartedBy: coordinator, updatedAt: now,
      };
      await activities.replaceOne({ _id: activityId }, after);
      await writeAudit(collections, { actorId: coordinator, action: 'update', collection: 'activities', recordId: activityId, before: activity, after });
    } else {
      activityId = new ObjectId();
      const created: Activity = {
        _id: activityId, name: DEMO_NAME, location: 'Bodega principal, Av. Periférico Poniente 7850, Zapopan',
        description: 'Actividad de prueba para mostrar el registro de asistencia con código QR.',
        startsAt, endsAt, capacity: 10, assignedCount: 0, status: 'open', supervisorId: supervisor,
        attendanceStartedAt: now, attendanceStartedBy: coordinator, createdBy: coordinator, createdAt: now, updatedAt: now,
      };
      await activities.insertOne(created);
      await writeAudit(collections, { actorId: coordinator, action: 'insert', collection: 'activities', recordId: activityId, after: created });
    }

    const assignedIds = await assignments.distinct('volunteerId', { activityId, status: 'assigned' });
    const assignedSet = new Set(assignedIds.map((id) => id.toHexString()));
    const busy = await busyIn(activityId);
    const candidates = await volunteers.find({ status: 'active' }, { projection: { firstName: 1, lastName: 1, checkinToken: 1 }, sort: { lastName: 1, firstName: 1 } }).toArray();

    const chosen: DemoVolunteer[] = candidates.filter((person) => assignedSet.has(person._id.toHexString()));
    for (const person of candidates) {
      if (chosen.length >= ASSIGNED) break;
      const key = person._id.toHexString();
      if (assignedSet.has(key) || busy.has(key)) continue;
      // Reuses a cancelled assignment's slot if there is one: (volunteerId, activityId) is unique.
      const previous = await assignments.findOne({ volunteerId: person._id, activityId });
      if (previous) {
        const after: Assignment = { ...previous, status: 'assigned', assignedBy: coordinator, updatedAt: now };
        delete after.cancelledAt; delete after.cancelledBy; delete after.cancelledReason;
        await assignments.replaceOne({ _id: previous._id }, after);
        await writeAudit(collections, { actorId: coordinator, action: 'update', collection: 'assignments', recordId: previous._id, before: previous, after });
      } else {
        const assignment: Assignment = { _id: new ObjectId(), volunteerId: person._id, activityId, assignedBy: coordinator, status: 'assigned', createdAt: now, updatedAt: now };
        await assignments.insertOne(assignment);
        await writeAudit(collections, { actorId: coordinator, action: 'insert', collection: 'assignments', recordId: assignment._id, after: assignment });
      }
      chosen.push(person);
    }
    if (chosen.length < ASSIGNED) throw new SeedError(`Se necesitan ${ASSIGNED} voluntarios activos libres en ese horario; corre npm run server:seed:demo -- --yes o registra más.`);

    const before = await activities.findOne({ _id: activityId });
    const assignedCount = await assignments.countDocuments({ activityId, status: 'assigned' });
    if (before && before.assignedCount !== assignedCount) {
      const after = await activities.findOneAndUpdate({ _id: activityId }, { $set: { assignedCount, updatedAt: now } }, { returnDocument: 'after' });
      await writeAudit(collections, { actorId: coordinator, action: 'update', collection: 'activities', recordId: activityId, before, after });
    }

    const chosenSet = new Set(chosen.map((person) => person._id.toHexString()));
    const outsider = candidates.find((person) => !chosenSet.has(person._id.toHexString()));
    if (!outsider) throw new SeedError('Se necesita al menos un voluntario activo más que no esté asignado.');

    const withToken = async (person: DemoVolunteer) => {
      if (person.checkinToken) return person.checkinToken;
      const previous = await volunteers.findOne({ _id: person._id });
      const token = newCheckinToken();
      const after = await volunteers.findOneAndUpdate({ _id: person._id, checkinToken: { $exists: false } },
        { $set: { checkinToken: token, checkinTokenIssuedAt: now, updatedAt: now } }, { returnDocument: 'after' });
      if (!after?.checkinToken) throw new SeedError('Un voluntario recibió código mientras corría el seed; vuelve a correrlo.');
      await writeAudit(collections, { actorId: coordinator, action: 'update', collection: 'volunteers', recordId: person._id, before: previous, after });
      return after.checkinToken;
    };

    const cards: { title: string; note: string; token: string }[] = [];
    for (const person of chosen) {
      cards.push({ title: `${person.firstName} ${person.lastName}`, note: 'Asignado', token: await withToken(person) });
    }
    cards.push({ title: `${outsider.firstName} ${outsider.lastName}`, note: 'Activo, sin lugar en esta actividad', token: await withToken(outsider) });
    // Matches the token pattern, so the phone sends it and the server answers "Código no válido".
    cards.push({ title: 'Código falso', note: 'Bien formado, pero no es de nadie', token: newCheckinToken() });

    await writeFile(OUTPUT, await demoPage(cards, startsAt), { mode: 0o600 });
    console.log(`Listo: «${DEMO_NAME}» empieza a las ${startsAt.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: 'numeric', minute: '2-digit' })} con ${chosen.length} voluntarios asignados y la asistencia ya iniciada.`);
    console.log('Abre server/demo-qr.html en la laptop para escanear los códigos.');
    console.log('Ese archivo tiene nombres y códigos que funcionan: bórralo al terminar la demostración.');
  } finally {
    await client.close();
  }
}

// The latest demo activity, if it can be reused as is: not cancelled or finalized, no attendance taken,
// and everyone on it still active and free in the new window. Otherwise a fresh one is created.
async function reusableDemo(collections: V2Collections, busyIn: (activityId: ObjectId | null) => Promise<Set<string>>) {
  const { activities, assignments, attendance, volunteers } = collections;
  const activity = await activities.findOne({ name: DEMO_NAME }, { sort: { createdAt: -1 } });
  if (!activity || activity.status === 'cancelled' || activity.attendanceFinalizedAt) return null;
  const assigned = await assignments.find({ activityId: activity._id, status: 'assigned' }, { projection: { _id: 1, volunteerId: 1 } }).toArray();
  if (await attendance.countDocuments({ assignmentId: { $in: assigned.map((entry) => entry._id) } })) return null;
  const busy = await busyIn(activity._id);
  if (assigned.some((entry) => busy.has(entry.volunteerId.toHexString()))) return null;
  const inactive = await volunteers.countDocuments({ _id: { $in: assigned.map((entry) => entry.volunteerId) }, status: 'inactive' });
  return inactive ? null : activity;
}

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

async function demoPage(cards: { title: string; note: string; token: string }[], startsAt: Date) {
  const items = await Promise.all(cards.map(async (card) => `
    <figure>
      ${await QRCode.toString(card.token, { type: 'svg', margin: 2, width: 220, errorCorrectionLevel: 'M' })}
      <figcaption><strong>${escape(card.title)}</strong><span>${escape(card.note)}</span></figcaption>
    </figure>`));
  const time = startsAt.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo de escaneo QR</title>
<style>
  body { margin: 0; padding: 32px; font: 16px/1.4 system-ui, sans-serif; background: #F4F6F3; color: #15211A; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  p { margin: 0 0 24px; color: #5A6B60; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px; }
  figure { margin: 0; padding: 16px; background: #fff; border-radius: 16px; text-align: center; box-shadow: 0 1px 3px rgba(21, 33, 26, .12); }
  svg { width: 220px; height: 220px; }
  figcaption { display: grid; gap: 2px; margin-top: 8px; }
  figcaption span { color: #5A6B60; font-size: 14px; }
</style>
</head>
<body>
<h1>${escape(DEMO_NAME)}</h1>
<p>Empieza el ${escape(time)}. Contiene códigos que funcionan: borra este archivo al terminar.</p>
<main>${items.join('')}
</main>
</body>
</html>
`;
}

void seedQrDemo().catch((error: unknown) => {
  console.error(error instanceof SeedError ? error.message : 'No se pudo preparar la demostración. Revisa la conexión con MongoDB.');
  process.exitCode = 1;
});
