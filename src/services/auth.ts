export type StaffRole = 'admin' | 'coordinator' | 'supervisor';

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

export class AuthError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}

const roles: readonly string[] = ['admin', 'coordinator', 'supervisor'];

// The API is trusted but its responses are still checked, so a malformed reply becomes a
// plain error instead of a crash deep inside a screen.
function isStaff(value: unknown): value is Staff {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value && typeof value.id === 'string'
    && 'fullName' in value && typeof value.fullName === 'string'
    && 'email' in value && typeof value.email === 'string'
    && 'role' in value && roles.includes(String(value.role))
    && 'active' in value && typeof value.active === 'boolean';
}

async function request(path: 'login' | 'me' | 'logout', token?: string, body?: unknown): Promise<unknown> {
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
      throw new AuthError(path === 'login' ? 'El correo o la contraseña no son correctos.' : 'Tu sesión terminó. Inicia sesión de nuevo.', 401);
    }
    if (response.status === 429) throw new AuthError('Hiciste varios intentos seguidos. Espera 15 minutos y vuelve a intentarlo.', 429);
    if (!response.ok) throw new AuthError('No pudimos completar la solicitud. Inténtalo de nuevo en unos minutos.', response.status);
    if (response.status === 204) return null;
    return await response.json() as unknown;
  } catch (error: unknown) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.');
  } finally { clearTimeout(timeout); }
}

export async function loginStaff(email: string, password: string) {
  const result = await request('login', undefined, { email: email.trim().toLowerCase(), password });
  if (typeof result !== 'object' || result === null || !('token' in result)
    || typeof result.token !== 'string' || !/^[a-f0-9]{64}$/.test(result.token)
    || !('staff' in result) || !isStaff(result.staff)) {
    throw new AuthError('No pudimos confirmar el inicio de sesión. Inténtalo de nuevo.');
  }
  return { token: result.token, staff: result.staff };
}

export async function currentStaff(token: string): Promise<Staff> {
  const result = await request('me', token);
  if (typeof result !== 'object' || result === null || !('staff' in result) || !isStaff(result.staff)) {
    throw new AuthError('No pudimos cargar los datos de tu cuenta. Inténtalo de nuevo.');
  }
  return result.staff;
}

export async function logoutStaff(token: string): Promise<void> { await request('logout', token); }

export function authMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : 'No pudimos guardar la sesión en este teléfono. Inténtalo de nuevo.';
}
