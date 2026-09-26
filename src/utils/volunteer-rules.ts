// Mirrors the zod rules and messages in server/src/volunteers.ts, which are the source of truth.
// The copy here only gives staff feedback before sending; the API checks everything again.

export interface VolunteerDraft {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string; // YYYY-MM-DD or ''
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
}

export type DraftField = keyof VolunteerDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const emptyDraft: VolunteerDraft = {
  firstName: '', lastName: '', phone: '', email: '', birthDate: '',
  emergencyContactName: '', emergencyContactPhone: '', notes: '',
};

const messages: Record<DraftField, string> = {
  firstName: 'Escribe el nombre (hasta 60 caracteres).',
  lastName: 'Escribe los apellidos (hasta 80 caracteres).',
  phone: 'Escribe un teléfono válido de 10 dígitos.',
  email: 'Escribe un correo válido, por ejemplo nombre@correo.com.',
  birthDate: 'Elige una fecha de nacimiento pasada, posterior a 1900.',
  emergencyContactName: 'Escribe el nombre del contacto de emergencia (hasta 100 caracteres).',
  emergencyContactPhone: 'Escribe un teléfono válido de 10 dígitos para el contacto de emergencia.',
  notes: 'Las notas pueden tener hasta 1000 caracteres.',
};

const controlChars = /\p{Cc}/u;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const storedPhone = /^\+[1-9]\d{7,14}$/;

// Staff type a local 10-digit number; the API stores it with +52. A number that already starts
// with + is kept as typed (spaces and dashes removed), for foreign phones.
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, '');
  if (compact.startsWith('+')) return compact;
  if (/^\d{10}$/.test(compact)) return `+52${compact}`;
  return compact;
}

// +523312345678 → 33 1234 5678 for Mexican numbers; anything else as stored.
export function formatPhone(stored: string): string {
  const match = /^\+52(\d{2})(\d{4})(\d{4})$/.exec(stored);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : stored;
}

// What the form shows when editing: Mexican numbers without the +52 staff never typed.
export function editablePhone(stored: string): string {
  return stored.startsWith('+52') && stored.length === 13 ? stored.slice(3) : stored;
}

function todayInMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function nameOk(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max && !controlChars.test(trimmed);
}

export function validateDraft(draft: VolunteerDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!nameOk(draft.firstName, 60)) errors.firstName = messages.firstName;
  if (!nameOk(draft.lastName, 80)) errors.lastName = messages.lastName;
  if (!storedPhone.test(normalizePhone(draft.phone))) errors.phone = messages.phone;
  const email = draft.email.trim();
  if (email && (!emailPattern.test(email) || email.length > 254)) errors.email = messages.email;
  if (draft.birthDate && !(draft.birthDate > '1900-01-01' && draft.birthDate < todayInMexico())) errors.birthDate = messages.birthDate;
  if (!nameOk(draft.emergencyContactName, 100)) errors.emergencyContactName = messages.emergencyContactName;
  if (!storedPhone.test(normalizePhone(draft.emergencyContactPhone))) errors.emergencyContactPhone = messages.emergencyContactPhone;
  if (draft.notes.trim().length > 1000) errors.notes = messages.notes;
  return errors;
}

// The body the API expects. Optional fields go as '' so an edit can clear them.
export function draftToPayload(draft: VolunteerDraft) {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    phone: normalizePhone(draft.phone),
    email: draft.email.trim().toLowerCase(),
    birthDate: draft.birthDate,
    emergencyContactName: draft.emergencyContactName.trim(),
    emergencyContactPhone: normalizePhone(draft.emergencyContactPhone),
    notes: draft.notes.trim(),
  };
}
