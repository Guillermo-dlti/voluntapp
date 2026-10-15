import { writeAudit } from './audit.js';
import { newCheckinToken } from './checkin-token.js';
import { inTransaction } from './common.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';

// One time backfill for QR check in: gives a check in token to every volunteer created before tokens
// existed. Each one is its own transaction with an `update` audit entry, acted by the admin named in
// --actor. Volunteers that already have a token are never touched, so running it again does nothing.
//   npm run server:backfill:checkin -- --actor admin@bamx.test

function actorEmail(): string | null {
  const index = process.argv.indexOf('--actor');
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ? value.trim().toLowerCase() : null;
}

async function backfill() {
  const email = actorEmail();
  if (!email) {
    console.error('Indica quién hace el cambio: --actor <correo de una cuenta de administración activa>.');
    process.exitCode = 1;
    return;
  }
  const config = loadConfig();
  const { client, collections } = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB);
  const { staffUsers, volunteers } = collections;
  try {
    const actor = await staffUsers.findOne({ email, role: 'admin', active: true }, { projection: { _id: 1 } });
    if (!actor) {
      console.error('Esa cuenta no existe, no es de administración o está inactiva.');
      process.exitCode = 1;
      return;
    }
    const pending = await volunteers.find({ checkinToken: { $exists: false } }, { projection: { _id: 1 } }).toArray();
    let issued = 0;
    for (const { _id } of pending) {
      const changed = await inTransaction(client, async (session) => {
        const before = await volunteers.findOne({ _id, checkinToken: { $exists: false } }, { session });
        // Someone issued one from the app between the listing and now.
        if (!before) return false;
        const now = new Date();
        const after = await volunteers.findOneAndUpdate(
          { _id, checkinToken: { $exists: false } },
          { $set: { checkinToken: newCheckinToken(), checkinTokenIssuedAt: now, updatedAt: now } },
          { session, returnDocument: 'after' },
        );
        await writeAudit(collections, { actorId: actor._id, action: 'update', collection: 'volunteers', recordId: _id, before, after }, session);
        return true;
      });
      if (changed) issued += 1;
    }
    console.log(issued ? `Listo: ${issued} voluntarios recibieron su código QR.` : 'Todos los voluntarios ya tenían código QR. No se cambió nada.');
  } finally {
    await client.close();
  }
}

backfill().catch((error: unknown) => {
  console.error('No se pudo completar el backfill. Revisa la conexión a MongoDB y el .env.');
  console.error(error instanceof Error ? error.name : 'Error');
  process.exitCode = 1;
});
