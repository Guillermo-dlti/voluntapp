import { readSession } from '@/services/session-storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    // Field-level messages from a 400/409, keyed by field name.
    public readonly fields: Record<string, string> = {},
  ) { super(message); }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  // Omitted: the stored session token is sent. null: no token (login).
  token?: string | null;
  // Overrides the default sentence for a status, such as login's 401.
  messages?: Partial<Record<number, string>>;
}

const sessionEnded = 'Tu sesión terminó. Inicia sesión de nuevo.';

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

// The API's 400/403/404/409 messages are Spanish sentences written for staff, so they're shown as is.
// Anything else (500s, proxies, HTML error pages) becomes a fixed plain sentence.
function serverMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('message' in body) || typeof body.message !== 'string') return null;
  return body.message.length <= 200 ? body.message : null;
}

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!base || !/^https?:\/\//.test(base)) throw new ApiError('El servicio no está disponible por el momento.');
  const token = options.token === undefined ? await readSession() : options.token;
  if (options.token === undefined && !token) throw new ApiError(sessionEnded, 401);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    const override = options.messages?.[response.status];
    if (override) throw new ApiError(override, response.status);
    if (response.status === 401) throw new ApiError(sessionEnded, 401);
    if (response.status === 429) throw new ApiError('Hiciste varios intentos seguidos. Espera 15 minutos y vuelve a intentarlo.', 429);
    if (response.status === 204) return null;
    const body: unknown = await response.json().catch(() => null);
    if ([400, 403, 404, 409].includes(response.status)) {
      const fields = typeof body === 'object' && body !== null && 'fields' in body ? stringRecord(body.fields) : {};
      throw new ApiError(serverMessage(body) ?? 'No pudimos completar la solicitud. Revisa los datos e inténtalo de nuevo.', response.status, fields);
    }
    if (!response.ok) throw new ApiError('No pudimos completar la solicitud. Inténtalo de nuevo en unos minutos.', response.status);
    return body;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.');
  } finally { clearTimeout(timeout); }
}

export function apiMessage(error: unknown, fallback = 'Ocurrió un problema. Inténtalo de nuevo.'): string {
  return error instanceof ApiError ? error.message : fallback;
}
