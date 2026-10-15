import { ObjectId } from 'mongodb';
import { writeAudit } from './audit.js';
import { newCheckinToken } from './checkin-token.js';
import type { Activity, Assignment, Attendance, Volunteer } from './collections.js';
import { addDays, mexicoDayStart, mexicoParts } from './common.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';

// Demo data for presentations. DESTRUCTIVE: deletes every volunteer, activity, assignment,
// attendance record and audit entry, then inserts a small, believable set. Staff accounts are kept
// (run `npm run seed:staff` first). Dates are relative to today in Guadalajara, so rerunning it on
// demo day keeps "Próximas" and "Por finalizar" current. Needs `--yes` to run.

const { year, month, day } = mexicoParts(new Date());
const today = `${year}-${month}-${day}`;
// A Guadalajara wall clock moment `offset` days from today.
const at = (offset: number, hour: number, minute = 0) =>
  new Date(mexicoDayStart(addDays(today, offset)).getTime() + (hour * 60 + minute) * 60_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

interface VolunteerSeed {
  firstName: string; lastName: string; email?: string; phone: string; birth?: string;
  contact: string; contactPhone: string; notes?: string; inactive?: boolean;
}

const volunteerSeeds: VolunteerSeed[] = [
  { firstName: 'Ana Sofía', lastName: 'Ramírez Ortega', email: 'ana.ramirez@example.com', phone: '+523312458796', birth: '1998-03-14', contact: 'Laura Ortega', contactPhone: '+523318820145', notes: 'Prefiere turnos de mañana.' },
  { firstName: 'Carlos', lastName: 'Mendoza Ibarra', email: 'carlos.mendoza@example.com', phone: '+523317709342', birth: '1987-11-02', contact: 'Rosa Ibarra', contactPhone: '+523314456720', notes: 'Tiene licencia de manejo; puede apoyar en rutas de entrega.' },
  { firstName: 'Valeria', lastName: 'Gutiérrez Navarro', email: 'vale.gutierrez@example.com', phone: '+523336254410', birth: '2003-06-21', contact: 'Miguel Gutiérrez', contactPhone: '+523319983301', notes: 'Estudiante de Nutrición; servicio social.' },
  { firstName: 'Jorge Luis', lastName: 'Castillo Pérez', phone: '+523311873365', birth: '1975-01-30', contact: 'Elena Pérez', contactPhone: '+523312204478' },
  { firstName: 'Fernanda', lastName: 'Aguilar Ríos', email: 'fer.aguilar@example.com', phone: '+523318427790', birth: '2001-09-09', contact: 'Patricia Ríos', contactPhone: '+523315567012' },
  { firstName: 'Diego', lastName: 'Hernández Salas', email: 'diego.hernandez@example.com', phone: '+523313390478', birth: '1994-04-17', contact: 'Andrea Salas', contactPhone: '+523317741209', notes: 'Voluntario corporativo.' },
  { firstName: 'Paola', lastName: 'Medina Cervantes', email: 'paola.medina@example.com', phone: '+523319025563', birth: '1999-12-05', contact: 'Jorge Medina', contactPhone: '+523310098874' },
  { firstName: 'Ricardo', lastName: 'Vázquez Lomelí', phone: '+523316614027', birth: '1968-08-23', contact: 'Teresa Lomelí', contactPhone: '+523313347756', notes: 'Jubilado; disponible entre semana.' },
  { firstName: 'Lucía', lastName: 'Flores Arellano', email: 'lucia.flores@example.com', phone: '+523314782215', birth: '2002-02-11', contact: 'Martha Arellano', contactPhone: '+523316612390' },
  { firstName: 'Emilio', lastName: 'Navarro Chávez', email: 'emilio.navarro@example.com', phone: '+523312267984', birth: '1991-07-28', contact: 'Sandra Chávez', contactPhone: '+523318845567' },
  { firstName: 'Regina', lastName: 'Soto Villaseñor', email: 'regina.soto@example.com', phone: '+523317750136', birth: '2000-10-19', contact: 'Alberto Soto', contactPhone: '+523311129943' },
  { firstName: 'Héctor', lastName: 'Jiménez Orozco', phone: '+523315538802', birth: '1983-05-06', contact: 'Gabriela Orozco', contactPhone: '+523314470021', notes: 'Se mudó a Monterrey en septiembre.', inactive: true },
];

type Mark = 'P' | 'A' | ['L', number];
interface ActivitySeed {
  name: string; location: string; description?: string; requirements?: string;
  day: number; from: number; to: number; capacity: number;
  status: Activity['status']; supervised?: boolean; finalized?: boolean;
  // Volunteer index (into volunteerSeeds) and, when attendance was taken, how it went.
  people: [number, Mark?][];
}

const bodega = 'Bodega principal, Av. Periférico Poniente 7850, Zapopan';
const centro = 'Centro BAMX, Hacienda La Calerilla 360, Tlaquepaque';

const activitySeeds: ActivitySeed[] = [
  // Finalized: give Reportes and volunteer hours real numbers.
  { name: 'Clasificación de despensas', location: bodega, day: -26, from: 9, to: 13, capacity: 10, status: 'closed', supervised: true, finalized: true,
    description: 'Separar y clasificar producto donado para armar despensas familiares.', requirements: 'Zapato cerrado y cabello recogido.',
    people: [[0, 'P'], [1, 'P'], [2, 'P'], [3, 'P'], [4, ['L', 45]], [5, 'P'], [6, 'P']] },
  { name: 'Entrega de despensas en Tonalá', location: 'Centro comunitario Loma Dorada, Tonalá', day: -19, from: 8, to: 12, capacity: 8, status: 'closed', finalized: true,
    description: 'Entrega de despensas a familias inscritas en el programa comunitario.',
    people: [[1, 'P'], [3, 'P'], [5, 'P'], [7, 'A'], [8, 'P']] },
  { name: 'Colecta en supermercados', location: 'Soriana Plaza Patria, Zapopan', day: -12, from: 10, to: 14, capacity: 12, status: 'closed', supervised: true, finalized: true,
    description: 'Invitar a los clientes a donar productos no perecederos a la salida de cajas.',
    people: [[0, 'P'], [2, 'P'], [4, 'P'], [6, ['L', 30]], [8, 'P'], [9, 'P'], [10, 'P']] },
  { name: 'Inventario de bodega fría', location: bodega, day: -8, from: 9, to: 12, capacity: 6, status: 'closed', finalized: true,
    requirements: 'Chamarra o suéter; la bodega está a 4 °C.',
    people: [[1, 'P'], [3, 'P'], [7, 'P'], [9, 'P']] },
  { name: 'Empaque de canastas escolares', location: centro, day: -5, from: 9, to: 13, capacity: 10, status: 'closed', supervised: true, finalized: true,
    description: 'Armar canastas con útiles y alimento para el regreso a clases.',
    people: [[0, 'P'], [2, 'P'], [5, 'A'], [6, 'P'], [8, 'P'], [10, 'P']] },
  // Cancelled: its assignments stay, as the rules require.
  { name: 'Feria de voluntariado universitario', location: 'Campus universitario, Av. General Ramón Corona 2514, Zapopan', day: -4, from: 10, to: 14, capacity: 15, status: 'cancelled',
    description: 'Módulo informativo para invitar a estudiantes a sumarse como voluntarios.',
    people: [[2], [4], [8]] },
  // Waiting to be finalized: one half recorded by the supervisor, one with nothing recorded yet.
  { name: 'Rescate de pan en panaderías', location: 'Ruta Chapultepec y Americana, Guadalajara', day: -2, from: 7, to: 10, capacity: 6, status: 'open', supervised: true,
    description: 'Recoger el pan del día anterior en panaderías aliadas y llevarlo a la bodega.',
    people: [[1, 'P'], [4, ['L', 30]], [7, 'P'], [9]] },
  { name: 'Taller de nutrición comunitaria', location: 'Casa de la Cultura, Tlaquepaque', day: -1, from: 17, to: 19, capacity: 20, status: 'open',
    description: 'Apoyo en la logística del taller de alimentación saludable para familias beneficiarias.',
    people: [[0], [2], [3], [5], [10]] },
  // Upcoming.
  { name: 'Clasificación de despensas', location: bodega, day: 1, from: 9, to: 13, capacity: 10, status: 'open', supervised: true,
    description: 'Separar y clasificar producto donado para armar despensas familiares.', requirements: 'Zapato cerrado y cabello recogido.',
    people: [[0], [1], [2], [4], [6], [8]] },
  { name: 'Entrega de despensas en Tlaquepaque', location: 'Colonia Las Juntas, Tlaquepaque', day: 3, from: 8, to: 12, capacity: 8, status: 'open',
    description: 'Entrega casa por casa a familias del padrón.', requirements: 'Mayores de 18 años.',
    people: [[3], [5], [7]] },
  { name: 'Rescate de frutas y verduras', location: 'Mercado de Abastos, Guadalajara', day: 6, from: 6, to: 10, capacity: 5, status: 'open', supervised: true,
    description: 'Recuperar producto en buen estado con los locatarios del mercado.', requirements: 'Guantes y ropa que se pueda ensuciar.',
    people: [[0], [1], [3], [9], [10]] },
  { name: 'Colecta en supermercados', location: 'Supermercados de Av. Vallarta, Zapopan', day: 8, from: 10, to: 14, capacity: 12, status: 'open',
    description: 'Invitar a los clientes a donar productos no perecederos a la salida de cajas.',
    people: [[2], [4], [6], [8]] },
  { name: 'Jornada de huertos urbanos', location: 'Huerto comunitario Colomos, Zapopan', day: 13, from: 9, to: 13, capacity: 15, status: 'draft',
    description: 'Siembra y mantenimiento del huerto que abastece al comedor comunitario.', people: [] },
];

async function seedDemo() {
  if (!process.argv.includes('--yes')) {
    console.error('Esto borra voluntarios, actividades, asignaciones, asistencia y bitácora. Ejecútalo con --yes para confirmar.');
    process.exitCode = 1;
    return;
  }
  const config = loadConfig();
  const { client, collections } = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB);
  const { staffUsers, volunteers, activities, assignments, attendance, auditLog } = collections;
  try {
    const staff = async (email: string) => {
      const found = await staffUsers.findOne({ email }, { projection: { _id: 1 } });
      if (!found) throw new Error(`Falta la cuenta ${email}; corre primero npm run seed:staff.`);
      return found._id;
    };
    const admin = await staff('admin@bamx.test');
    const coordinator = await staff('coordinador@bamx.test');
    const supervisor = await staff('supervisor@bamx.test');

    for (const collection of [attendance, assignments, activities, volunteers, auditLog] as const) await collection.deleteMany({});

    const volunteerIds: ObjectId[] = [];
    for (const [index, seed] of volunteerSeeds.entries()) {
      const created = daysAgo(90 - index * 4);
      const doc: Volunteer = {
        _id: new ObjectId(), firstName: seed.firstName, lastName: seed.lastName, phone: seed.phone,
        ...(seed.email ? { email: seed.email } : {}), ...(seed.birth ? { birthDate: new Date(`${seed.birth}T12:00:00Z`) } : {}),
        emergencyContactName: seed.contact, emergencyContactPhone: seed.contactPhone, status: seed.inactive ? 'inactive' : 'active',
        ...(seed.notes ? { notes: seed.notes } : {}), checkinToken: newCheckinToken(), checkinTokenIssuedAt: created, createdBy: index % 3 === 0 ? admin : coordinator, createdAt: created, updatedAt: created,
      };
      await volunteers.insertOne(doc);
      await writeAudit(collections, { actorId: doc.createdBy, action: 'insert', collection: 'volunteers', recordId: doc._id, after: doc });
      volunteerIds.push(doc._id);
    }

    let records = 0;
    for (const seed of activitySeeds) {
      const startsAt = at(seed.day, seed.from);
      const endsAt = at(seed.day, seed.to);
      const created = new Date(Math.min(startsAt.getTime() - 10 * 86_400_000, Date.now() - 3 * 86_400_000));
      const recorder = seed.supervised ? supervisor : coordinator;
      const finalizedAt = seed.finalized ? new Date(endsAt.getTime() + 2 * 3_600_000) : undefined;
      const assignedCount = seed.people.length;
      const activity: Activity = {
        _id: new ObjectId(), name: seed.name, location: seed.location, startsAt, endsAt, capacity: seed.capacity, assignedCount,
        ...(seed.description ? { description: seed.description } : {}), ...(seed.requirements ? { requirements: seed.requirements } : {}),
        status: seed.status, ...(seed.supervised ? { supervisorId: supervisor } : {}),
        ...(finalizedAt ? { attendanceFinalizedAt: finalizedAt, attendanceFinalizedBy: recorder } : {}),
        createdBy: coordinator, createdAt: created, updatedAt: finalizedAt ?? created,
      };
      await activities.insertOne(activity);
      await writeAudit(collections, { actorId: coordinator, action: 'insert', collection: 'activities', recordId: activity._id, after: activity });

      for (const [person, mark] of seed.people) {
        const assignedAt = new Date(created.getTime() + 86_400_000);
        const assignment: Assignment = {
          _id: new ObjectId(), volunteerId: volunteerIds[person] ?? volunteerIds[0]!, activityId: activity._id,
          assignedBy: coordinator, status: 'assigned', createdAt: assignedAt, updatedAt: assignedAt,
        };
        await assignments.insertOne(assignment);
        await writeAudit(collections, { actorId: coordinator, action: 'insert', collection: 'assignments', recordId: assignment._id, after: assignment });
        if (!mark) continue;

        const late = Array.isArray(mark) ? mark[1] : 0;
        const checkInAt = new Date(startsAt.getTime() + late * 60_000);
        const hours = Math.round(((endsAt.getTime() - checkInAt.getTime()) / 3_600_000) * 100) / 100;
        const record: Attendance = {
          _id: new ObjectId(), assignmentId: assignment._id,
          status: mark === 'A' ? 'absent' : late ? 'late' : 'present',
          ...(mark === 'A' ? {} : { checkInAt, checkOutAt: endsAt }),
          hours: mark === 'A' ? 0 : hours, recordedBy: recorder,
          finalized: !!finalizedAt, ...(finalizedAt ? { finalizedAt, finalizedBy: recorder } : {}),
          createdAt: endsAt, updatedAt: finalizedAt ?? endsAt,
        };
        await attendance.insertOne(record);
        await writeAudit(collections, { actorId: recorder, action: 'insert', collection: 'attendance', recordId: record._id, after: record });
        records += 1;
      }
    }
    console.log(`Listo: ${volunteerIds.length} voluntarios, ${activitySeeds.length} actividades, ${records} registros de asistencia.`);
  } finally {
    await client.close();
  }
}

await seedDemo();
