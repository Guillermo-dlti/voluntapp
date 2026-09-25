import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';
import { log } from './logger.js';

async function start() {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch {
    console.error('Revisa MONGODB_URI, MONGODB_DB, PORT y HOST en el archivo .env de la raíz.');
    process.exitCode = 1;
    return;
  }
  let connection: Awaited<ReturnType<typeof connectDatabase>>;
  try {
    connection = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB);
  } catch (error: unknown) {
    // Only the numeric code: Mongo messages can quote document values (e.g. a duplicate email).
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number' ? error.code : null;
    log.error('database_setup_failed', { code });
    console.error('No se pudo preparar MongoDB. Revisa la conexión, los permisos del usuario, la IP permitida en Atlas y que users no contenga correos o usuarios duplicados.');
    process.exitCode = 1;
    return;
  }
  const app = createApp(connection.database, connection.users);
  const server = app.listen(config.PORT, config.HOST, () => {
    console.log(`Backend disponible en http://${config.HOST}:${config.PORT}. MongoDB conectado.`);
  });
  server.on('error', () => {
    console.error('No se pudo iniciar el servidor. Revisa si el puerto está ocupado.');
    void connection.client.close().finally(() => { process.exitCode = 1; });
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(() => {
      void connection.client.close().finally(() => { clearTimeout(timeout); });
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void start().catch(() => {
  console.error('No se pudo iniciar el backend. Revisa la configuración e inténtalo de nuevo.');
  process.exitCode = 1;
});
