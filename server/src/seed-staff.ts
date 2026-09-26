import { hash } from 'argon2';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { passwordHashOptions } from './auth.js';
import { writeAudit } from './audit.js';
import type { StaffRole } from './collections.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';

// Local development only: creates the three demo staff accounts if they don't exist yet.
// Existing accounts are never modified, so running it twice is harmless.
const seedAccounts: { fullName: string; email: string; role: StaffRole }[] = [
  { fullName: 'Mariana Torres', email: 'admin@bamx.test', role: 'admin' },
  { fullName: 'Luis Hernández', email: 'coordinador@bamx.test', role: 'coordinator' },
  { fullName: 'Daniela Ruiz', email: 'supervisor@bamx.test', role: 'supervisor' },
];

async function seed() {
  const config = loadConfig();
  const password = z.string().min(15).max(128).safeParse(process.env.SEED_STAFF_PASSWORD);
  if (!password.success) {
    console.error('Define SEED_STAFF_PASSWORD en el .env de la raíz (entre 15 y 128 caracteres).');
    process.exitCode = 1;
    return;
  }
  const { client, collections } = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB);
  try {
    let adminId: ObjectId | null = null;
    for (const account of seedAccounts) {
      const now = new Date();
      const result = await collections.staffUsers.updateOne(
        { email: account.email },
        { $setOnInsert: {
          _id: new ObjectId(), ...account, active: true,
          passwordHash: await hash(password.data, passwordHashOptions), createdAt: now, updatedAt: now,
        } },
        { upsert: true },
      );
      const staff = await collections.staffUsers.findOne({ email: account.email }, { projection: { passwordHash: 0, sessions: 0 } });
      if (!staff) throw new Error('Seed account missing after upsert.');
      if (account.role === 'admin') adminId = staff._id;
      if (result.upsertedCount) {
        // The admin is seeded first and acts as the creator of the other seed accounts.
        await writeAudit(collections, { actorId: adminId ?? staff._id, action: 'insert', collection: 'staff_users', recordId: staff._id, after: staff });
        console.log(`Creada: ${account.email} (${account.role})`);
      } else {
        console.log(`Ya existía, sin cambios: ${account.email}`);
      }
    }
  } finally {
    await client.close();
  }
}

void seed().catch(() => {
  console.error('No se pudieron crear las cuentas de prueba. Revisa la conexión con MongoDB.');
  process.exitCode = 1;
});
