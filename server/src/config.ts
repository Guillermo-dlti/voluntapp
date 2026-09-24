import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const environmentSchema = z.object({
  MONGODB_URI: z.string().trim().min(1).refine(
    (value) => /^mongodb(?:\+srv)?:\/\//.test(value) && !/[<>]/.test(value),
  ),
  MONGODB_DB: z.string().trim().min(1).regex(/^[a-zA-Z0-9_-]+$/).default('voluntapp'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
});

export function loadConfig() {
  // Resolve from this module so npm --prefix and compiled startup use the same file.
  config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error('Revisa MONGODB_URI, MONGODB_DB, PORT y HOST en el archivo .env de la raíz.');
  }
  return result.data;
}
