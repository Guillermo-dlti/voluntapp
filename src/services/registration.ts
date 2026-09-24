import type { RegistrationInput } from '../validation/registration';

type RegistrationResult = { ok: true } | { ok: false; message: string };

function isSuccessfulRegistration(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('user' in value)) return false;
  const user = value.user;
  return typeof user === 'object' && user !== null && 'id' in user
    && typeof user.id === 'string' && /^[a-f0-9]{24}$/i.test(user.id);
}

export async function registerAccount(input: RegistrationInput): Promise<RegistrationResult> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return { ok: false, message: 'El registro no está disponible por el momento. Inténtalo más tarde.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name.trim(),
        username: input.username.trim().toLowerCase(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
      signal: controller.signal,
    });
    if (response.status === 201) {
      const body: unknown = await response.json();
      if (isSuccessfulRegistration(body)) return { ok: true };
      return { ok: false, message: 'No pudimos confirmar el registro. Espera un momento antes de intentarlo de nuevo.' };
    }
    if (response.status === 409) {
      return { ok: false, message: 'Ese correo o nombre de usuario ya está registrado. Revisa tus datos o usa otros.' };
    }
    if (response.status === 400) {
      return { ok: false, message: 'Revisa tu nombre, usuario, correo y contraseña antes de volver a intentarlo.' };
    }
    if (response.status === 429) {
      return { ok: false, message: 'Has hecho varios intentos. Espera 15 minutos antes de volver a intentarlo.' };
    }
    return { ok: false, message: 'No pudimos crear tu cuenta. Inténtalo de nuevo más tarde.' };
  } catch {
    return { ok: false, message: 'No pudimos confirmar el registro. Revisa tu conexión e inténtalo de nuevo; si tus datos ya aparecen registrados, la cuenta pudo haberse creado.' };
  } finally {
    clearTimeout(timeout);
  }
}
