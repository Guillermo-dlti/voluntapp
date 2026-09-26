import { ApiError, apiRequest } from '@/services/api';

export type StaffRole = 'admin' | 'coordinator' | 'supervisor';

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

// Kept under its old name for the auth provider; it is the shared API error.
export { ApiError as AuthError } from '@/services/api';

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

function request(path: 'login' | 'me' | 'logout', token: string | null, body?: unknown): Promise<unknown> {
  return apiRequest(`/api/auth/${path}`, {
    method: path === 'me' ? 'GET' : 'POST',
    token,
    body,
    ...(path === 'login' ? { messages: { 401: 'El correo o la contraseña no son correctos.' } } : {}),
  });
}

export async function loginStaff(email: string, password: string) {
  const result = await request('login', null, { email: email.trim().toLowerCase(), password });
  if (typeof result !== 'object' || result === null || !('token' in result)
    || typeof result.token !== 'string' || !/^[a-f0-9]{64}$/.test(result.token)
    || !('staff' in result) || !isStaff(result.staff)) {
    throw new ApiError('No pudimos confirmar el inicio de sesión. Inténtalo de nuevo.');
  }
  return { token: result.token, staff: result.staff };
}

export async function currentStaff(token: string): Promise<Staff> {
  const result = await request('me', token);
  if (typeof result !== 'object' || result === null || !('staff' in result) || !isStaff(result.staff)) {
    throw new ApiError('No pudimos cargar los datos de tu cuenta. Inténtalo de nuevo.');
  }
  return result.staff;
}

export async function logoutStaff(token: string): Promise<void> { await request('logout', token); }

export function authMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No pudimos guardar la sesión en este teléfono. Inténtalo de nuevo.';
}
