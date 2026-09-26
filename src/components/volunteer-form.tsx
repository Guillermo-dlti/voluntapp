import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { AppFonts, Brand } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { birthDateRange } from '@/utils/time';
import { validateDraft, type DraftErrors, type DraftField, type VolunteerDraft } from '@/utils/volunteer-rules';

interface VolunteerFormProps {
  initial: VolunteerDraft;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (draft: VolunteerDraft) => Promise<void>;
  // A 401 during save: the session is gone, so the app signs out.
  onSessionEnded: () => void;
}

const fields = new Set<string>(['firstName', 'lastName', 'phone', 'email', 'birthDate', 'emergencyContactName', 'emergencyContactPhone', 'notes']);

// Shared by "Nuevo voluntario" and "Editar voluntario": same fields, same checks, same messages.
export function VolunteerForm({ initial, submitLabel, busyLabel, onSubmit, onSessionEnded }: VolunteerFormProps) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const refs = {
    lastName: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    emergencyContactName: useRef<TextInput>(null),
    emergencyContactPhone: useRef<TextInput>(null),
    notes: useRef<TextInput>(null),
  };

  function set(field: DraftField) {
    return (value: string) => {
      setDraft((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
      setMessage('');
    };
  }

  async function submit() {
    if (pending.current) return;
    const invalid = validateDraft(draft);
    setErrors(invalid);
    if (Object.keys(invalid).length) { setMessage('Revisa los campos marcados.'); return; }
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await onSubmit(draft);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { onSessionEnded(); return; }
      if (cause instanceof ApiError) {
        const fromServer: DraftErrors = {};
        for (const [key, text] of Object.entries(cause.fields)) if (fields.has(key)) fromServer[key as DraftField] = text;
        setErrors(fromServer);
        setMessage(cause.message);
      } else {
        setMessage('No pudimos guardar los cambios. Inténtalo de nuevo.');
      }
    } finally { pending.current = false; setBusy(false); }
  }

  const range = birthDateRange();
  const common = { editable: !busy, autoCorrect: false } as const;

  return (
    <View style={styles.form}>
      <FormGroup title="Datos personales">
        <FormField testID="volunteer-first-name" label="Nombre" value={draft.firstName} onChangeText={set('firstName')}
          error={errors.firstName} maxLength={60} autoCapitalize="words" autoComplete="name-given" returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.lastName.current?.focus()} {...common} />
        <FormField ref={refs.lastName} testID="volunteer-last-name" label="Apellidos" value={draft.lastName} onChangeText={set('lastName')}
          error={errors.lastName} maxLength={80} autoCapitalize="words" autoComplete="name-family" returnKeyType="next"
          submitBehavior="submit" onSubmitEditing={() => refs.phone.current?.focus()} {...common} />
        <DateField testID="volunteer-birth-date" label="Fecha de nacimiento (opcional)" value={draft.birthDate}
          onChange={set('birthDate')} error={errors.birthDate} min={range.min} max={range.max} start={range.start} />
      </FormGroup>

      <FormGroup title="Contacto">
        <FormField ref={refs.phone} testID="volunteer-phone" label="Teléfono" value={draft.phone} onChangeText={set('phone')}
          error={errors.phone} hint="10 dígitos. Para un número de otro país, empieza con +." keyboardType="phone-pad"
          autoComplete="tel" maxLength={20} returnKeyType="next" submitBehavior="submit"
          onSubmitEditing={() => refs.email.current?.focus()} {...common} />
        <FormField ref={refs.email} testID="volunteer-email" label="Correo (opcional)" value={draft.email} onChangeText={set('email')}
          error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => refs.emergencyContactName.current?.focus()} {...common} />
      </FormGroup>

      <FormGroup title="Contacto de emergencia">
        <FormField ref={refs.emergencyContactName} testID="volunteer-emergency-name" label="Nombre" value={draft.emergencyContactName}
          onChangeText={set('emergencyContactName')} error={errors.emergencyContactName} maxLength={100} autoCapitalize="words"
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => refs.emergencyContactPhone.current?.focus()} {...common} />
        <FormField ref={refs.emergencyContactPhone} testID="volunteer-emergency-phone" label="Teléfono" value={draft.emergencyContactPhone}
          onChangeText={set('emergencyContactPhone')} error={errors.emergencyContactPhone} keyboardType="phone-pad" maxLength={20}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => refs.notes.current?.focus()} {...common} />
      </FormGroup>

      <FormGroup title="Notas">
        <FormField ref={refs.notes} testID="volunteer-notes" label="Notas (opcional)" value={draft.notes} onChangeText={set('notes')}
          error={errors.notes} hint="Disponibilidad, habilidades o lo que el equipo deba saber." multiline maxLength={1000}
          style={styles.notes} textAlignVertical="top" {...common} />
      </FormGroup>

      {message ? (
        <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View>
      ) : null}
      <Button testID="volunteer-submit" label={submitLabel} busyLabel={busyLabel} busy={busy} onPress={() => void submit()} />
    </View>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      <Card><View style={styles.groupBody}>{children}</View></Card>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  group: { gap: 8 },
  groupTitle: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary, paddingHorizontal: 4 },
  groupBody: { gap: 16 },
  notes: { minHeight: 110, paddingTop: 14 },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
