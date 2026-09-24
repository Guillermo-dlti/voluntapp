import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormField } from '@/components/form-field';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { registerAccount } from '@/services/registration';
import { validateRegistration, type RegistrationErrors, type RegistrationInput } from '@/validation/registration';

const emptyForm: RegistrationInput = { name: '', username: '', email: '', password: '' };

export default function SignUp() {
  const [form, setForm] = useState<RegistrationInput>(emptyForm);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const inFlight = useRef(false);

  function updateField(field: keyof RegistrationInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  }

  async function handleSignUp() {
    if (inFlight.current || created) return;
    const nextErrors = validateRegistration(form);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await registerAccount(form);
      if (result.ok) {
        setForm(emptyForm);
        setCreated(true);
      } else {
        setMessage(result.message);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!submitting && <BackButton inline />}
          {created ? (
            <View style={styles.form}>
              <Text accessibilityRole="header" style={styles.title}>¡Cuenta creada!</Text>
              <Text accessibilityLiveRegion="polite" style={styles.description}>
                Tu registro se completó correctamente. Gracias por sumarte como voluntario.
              </Text>
              <Text style={styles.description}>Ya puedes iniciar sesión con tu correo o nombre de usuario.</Text>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.buttonText}>Iniciar sesión</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text accessibilityRole="header" style={styles.title}>Crear Cuenta</Text>
              <FormField label="Nombre completo" value={form.name} onChangeText={(value) => updateField('name', value)}
                error={errors.name} editable={!submitting} autoComplete="name" maxLength={100} />
              <FormField label="Nombre de usuario" value={form.username} onChangeText={(value) => updateField('username', value)}
                error={errors.username} hint="De 3 a 30 letras, números, puntos o guiones bajos."
                editable={!submitting} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" maxLength={30} />
              <FormField label="Correo electrónico" value={form.email} onChangeText={(value) => updateField('email', value)}
                error={errors.email} editable={!submitting} autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address" autoComplete="email" maxLength={254} />
              <FormField label="Contraseña" value={form.password} onChangeText={(value) => updateField('password', value)}
                error={errors.password} hint="De 15 a 128 caracteres. Puedes usar una frase larga."
                editable={!submitting} secureTextEntry autoCapitalize="none" autoCorrect={false}
                autoComplete="new-password" maxLength={128} returnKeyType="done" onSubmitEditing={() => void handleSignUp()} />
              {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }}
                disabled={submitting} style={[styles.button, submitting && styles.disabled]} onPress={() => void handleSignUp()}>
                {submitting && <ActivityIndicator color="#fff" />}
                <Text style={styles.buttonText}>{submitting ? 'Creando cuenta…' : 'Registrarse'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  form: { gap: 16 },
  title: { fontFamily: AppFonts.heading, fontSize: 24, color: Brand.text, marginBottom: 8 },
  description: { fontFamily: AppFonts.body, fontSize: 16, lineHeight: 24, color: Brand.textSecondary },
  error: { fontFamily: AppFonts.body, color: '#B91C1C', fontSize: 14 },
  button: { backgroundColor: Brand.primary, borderRadius: Radius.button, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  disabled: { opacity: 0.65 },
  buttonText: { fontFamily: AppFonts.bodySemiBold, color: '#fff', fontSize: 16 },
});
