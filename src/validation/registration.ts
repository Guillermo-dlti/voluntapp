export interface RegistrationInput {
  name: string;
  username: string;
  email: string;
  password: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100 || /\p{Cc}/u.test(name)) {
    errors.name = 'Escribe tu nombre con entre 2 y 100 caracteres.';
  }
  if (!/^[a-z0-9_.]{3,30}$/.test(input.username.trim().toLowerCase())) {
    errors.username = 'Usa entre 3 y 30 letras, números, puntos o guiones bajos.';
  }
  const email = input.email.trim();
  if (email.length > 254 || !/^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/.test(email)) {
    errors.email = 'Escribe un correo electrónico válido.';
  }
  if (input.password.length < 15 || input.password.length > 128) {
    errors.password = 'Usa una contraseña de entre 15 y 128 caracteres.';
  }
  return errors;
}
