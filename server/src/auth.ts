import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { writeAudit } from './audit.js';
import type { V2Collections } from './collections.js';
import { log } from './logger.js';
import { SESSION_HOURS, bearerToken, currentStaff, publicStaff, requireStaff, tokenHash } from './session.js';

export const passwordHashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});

const wrongCredentials = { message: 'El correo o la contraseña no son correctos.' };

export function authRouter(collections: Pick<V2Collections, 'staffUsers' | 'auditLog'>) {
  const { staffUsers } = collections;
  const router = Router();
  // Verify against a real hash even for unknown emails, so response time doesn't reveal which accounts exist.
  const dummyHash = hash(randomBytes(32), passwordHashOptions);

  router.post('/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Has hecho varios intentos. Espera 15 minutos antes de volver a intentarlo.' },
  }), async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success || !request.is('application/json')) {
      response.status(400).json({ message: 'Escribe tu correo y tu contraseña.' });
      return;
    }
    const { email, password } = parsed.data;
    const staff = await staffUsers.findOne({ email });
    const valid = await verify(staff?.passwordHash ?? await dummyHash, password);
    // Same answer for unknown email, wrong password, and inactive account.
    if (!staff || !valid || !staff.active) {
      response.status(401).json(wrongCredentials);
      return;
    }
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
    // One atomic update adds the session and keeps only the five newest, so the array stays bounded
    // and a sixth login signs out the oldest device.
    const updated = await staffUsers.updateOne({ _id: staff._id, active: true }, {
      $push: { sessions: { $each: [{ tokenHash: tokenHash(token), createdAt: now, expiresAt }], $slice: -5 } },
    });
    if (!updated.matchedCount) {
      response.status(401).json(wrongCredentials);
      return;
    }
    await writeAudit(collections, { actorId: staff._id, action: 'login', collection: 'staff_users', recordId: staff._id });
    log.info('staff_login', { staffId: staff._id.toHexString() });
    response.json({ token, expiresAt: expiresAt.toISOString(), staff: publicStaff(staff) });
  });

  router.get('/me', requireStaff(staffUsers), async (_request, response) => {
    const { id } = currentStaff(response);
    const staff = await staffUsers.findOne({ _id: id, active: true });
    if (!staff) {
      response.status(401).json({ message: 'Tu sesión terminó. Inicia sesión de nuevo.' });
      return;
    }
    response.json({ staff: publicStaff(staff) });
  });

  // Always 204, even for an unknown token, so logout can't be used to probe which tokens are valid.
  router.post('/logout', async (request, response) => {
    const token = bearerToken(request);
    if (token) {
      const hashed = tokenHash(token);
      const staff = await staffUsers.findOneAndUpdate(
        { 'sessions.tokenHash': hashed },
        { $pull: { sessions: { tokenHash: hashed } } },
        { projection: { _id: 1 } },
      );
      if (staff) await writeAudit(collections, { actorId: staff._id, action: 'logout', collection: 'staff_users', recordId: staff._id });
    }
    response.status(204).end();
  });

  return router;
}
