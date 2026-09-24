import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { MongoServerError } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import { fieldMessages, registerUser, registrationSchema } from './users.js';
import type { Registration, User } from './users.js';

export function createApp(database: Db, users: Collection<User>) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', async (_request, response) => {
    try {
      await database.command({ ping: 1 });
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ message: 'El servicio no está disponible por el momento.' });
    }
  });

  app.use('/api/auth/register', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Has hecho varios intentos. Espera 15 minutos antes de volver a intentarlo.' },
  }));
  app.use(express.json({ limit: '16kb' }));

  app.post('/api/auth/register', async (
    request: Request<Record<string, never>, unknown, unknown>, response,
  ) => {
    if (!request.is('application/json')) {
      response.status(415).json({ message: 'Envía los datos en formato JSON.' });
      return;
    }
    const result = registrationSchema.safeParse(request.body);
    if (!result.success) {
      const fields: Partial<Record<keyof Registration, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && Object.hasOwn(fieldMessages, field)) {
          const key = field as keyof Registration;
          fields[key] = fieldMessages[key];
        }
      }
      response.status(400).json({
        message: 'Revisa los datos del registro y envía únicamente los campos permitidos.',
        fields,
      });
      return;
    }
    try {
      const user = await registerUser(users, result.data);
      response.status(201).json({ message: 'Tu cuenta se creó correctamente.', user });
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        response.status(409).json({ message: 'No pudimos crear la cuenta con ese correo o nombre de usuario. Usa otros datos o inicia sesión si ya tienes una cuenta.' });
        return;
      }
      response.status(503).json({ message: 'No pudimos crear tu cuenta. Inténtalo de nuevo más tarde.' });
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ message: 'No encontramos la ruta solicitada.' });
  });
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? error.status : undefined;
    if (status === 413) {
      response.status(413).json({ message: 'Los datos enviados son demasiado grandes.' });
      return;
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      response.status(400).json({ message: 'No pudimos leer los datos enviados. Revisa el formato JSON.' });
      return;
    }
    response.status(500).json({ message: 'Ocurrió un problema. Inténtalo de nuevo más tarde.' });
  });
  return app;
}
