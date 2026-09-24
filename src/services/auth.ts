export interface Account {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'volunteer' | 'bamx_admin' | 'technical_admin';
  status: 'active' | 'inactive';
  phone?: string;
}

export class AuthError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}

function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value && typeof value.id === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'username' in value && typeof value.username === 'string'
    && 'email' in value && typeof value.email === 'string'
    && 'role' in value && ['volunteer', 'bamx_admin', 'technical_admin'].includes(String(value.role))
    && 'status' in value && ['active', 'inactive'].includes(String(value.status))
    && (!('phone' in value) || typeof value.phone === 'string');
}

async function request(path: string, token?: string, body?: unknown): Promise<unknown> {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!base || !/^https?:\/\//.test(base)) throw new AuthError('El servicio no está disponible por el momento.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/api/auth/${path}`, {
      method: path === 'me' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (response.status === 401) {
      throw new AuthError(path === 'login' ? 'El correo, usuario o contraseña no son correctos.' : 'Tu sesión terminó. Inicia sesión de nuevo.', 401);
    }
    if (response.status === 429) throw new AuthError('Has hecho varios intentos. Espera 15 minutos antes de volver a intentarlo.', 429);
    if (!response.ok) throw new AuthError('No pudimos completar la solicitud. Inténtalo de nuevo más tarde.', response.status);
    if (response.status === 204) return null;
    return await response.json() as unknown;
  } catch (error: unknown) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.');
  } finally { clearTimeout(timeout); }
}

export async function loginAccount(identifier: string, password: string) {
  const result = await request('login', undefined, { identifier: identifier.trim().toLowerCase(), password });
  if (typeof result !== 'object' || result === null || !('token' in result)
    || typeof result.token !== 'string' || !/^[a-f0-9]{64}$/.test(result.token)
    || !('user' in result) || !isAccount(result.user)) {
    throw new AuthError('No pudimos confirmar el inicio de sesión. Inténtalo de nuevo.');
  }
  return { token: result.token, user: result.user };
}

export async function currentAccount(token: string): Promise<Account> {
  const result = await request('me', token);
  if (typeof result !== 'object' || result === null || !('user' in result) || !isAccount(result.user)) {
    throw new AuthError('No pudimos cargar los datos de tu cuenta. Inténtalo de nuevo.');
  }
  return result.user;
}

export async function logoutAccount(token: string): Promise<void> { await request('logout', token); }

export function authMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : 'No pudimos guardar los cambios de sesión en este dispositivo. Inténtalo de nuevo.';
}
