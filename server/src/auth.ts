import { createHash, randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Collection } from 'mongodb';
import { z } from 'zod';
import { publicUser, type User } from './users.js';

const loginSchema = z.strictObject({
  identifier: z.string().trim().toLowerCase().min(3).max(254),
  password: z.string().min(1).max(128),
});

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function bearer(header: string | undefined): string | null {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(header ?? '');
  return match?.[1] ?? null;
}

export function authRouter(users: Collection<User>) {
  const router = Router();
  // Verify a real hash even for unknown accounts to reduce timing differences.
  const dummyHash = hash(randomBytes(32), { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  router.post('/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Has hecho varios intentos. Espera 15 minutos antes de volver a intentarlo.' },
  }), async (request, response) => {
    const input: unknown = request.body;
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success || !request.is('application/json')) {
      response.status(400).json({ message: 'Escribe tu correo o usuario y tu contraseña.' });
      return;
    }
    const { identifier, password } = parsed.data;
    const user = await users.findOne(identifier.includes('@') ? { email: identifier } : { username: identifier });
    const valid = await verify(user?.passwordHash ?? await dummyHash, password);
    if (!user || !valid || user.status !== 'active') {
      response.status(401).json({ message: 'El correo, usuario o contraseña no son correctos.' });
      return;
    }
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    // One atomic push caps concurrent logins and keeps the document bounded.
    const updated = await users.updateOne({ _id: user._id, status: 'active' }, {
      $push: { sessions: { $each: [{ tokenHash: tokenHash(token), createdAt: now, expiresAt }], $slice: -5 } },
    });
    if (!updated.matchedCount) {
      response.status(401).json({ message: 'No pudimos iniciar sesión con esta cuenta.' });
      return;
    }
    response.json({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) });
  });

  router.get('/me', async (request, response) => {
    const token = bearer(request.headers.authorization);
    const user = token ? await users.findOne({
      status: 'active', sessions: { $elemMatch: { tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } } },
    }) : null;
    if (!user) {
      response.status(401).json({ message: 'Tu sesión terminó. Inicia sesión de nuevo.' });
      return;
    }
    response.json({ user: publicUser(user) });
  });

  router.post('/logout', async (request, response) => {
    const token = bearer(request.headers.authorization);
    if (token) {
      await users.updateOne({ 'sessions.tokenHash': tokenHash(token) }, {
        $pull: { sessions: { tokenHash: tokenHash(token) } },
      });
    }
    response.status(204).end();
  });
  return router;
}
