import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Db } from 'mongodb';
import { authRouter } from './auth.js';
import type { V2Collections } from './collections.js';
import { log } from './logger.js';
import { volunteersRouter } from './volunteers.js';

export function createApp(database: Db, collections: V2Collections) {
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

  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', authRouter(collections));
  app.use('/api/volunteers', volunteersRouter(collections, database.client));

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
    log.error('unhandled_error');
    response.status(500).json({ message: 'Ocurrió un problema. Inténtalo de nuevo más tarde.' });
  });
  return app;
}
