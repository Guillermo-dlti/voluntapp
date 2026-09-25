import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { FormField } from '@/components/form-field';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { authMessage } from '@/services/auth';

export default function Login() {
  const { signIn, error: sessionError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function handleLogin() {
    if (pending.current) return;
    const invalid = {
      ...(identifier.trim().length < 3 || identifier.trim().length > 254 ? { identifier: 'Escribe tu correo o nombre de usuario.' } : {}),
      ...(!password || password.length > 128 ? { password: 'Escribe tu contraseña.' } : {}),
    };
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) return;
    pending.current = true;
    setBusy(true);
    try { await signIn(identifier, password); setPassword(''); }
    catch (cause: unknown) { setMessage(authMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!busy && <BackButton inline />}
          <Text accessibilityRole="header" style={styles.title}>Iniciar Sesión</Text>
          <FormField testID="login-email-input" label="Correo o nombre de usuario" value={identifier} editable={!busy}
            onChangeText={(value) => { setIdentifier(value); setErrors({}); setMessage(''); }} error={errors.identifier}
            autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={254} />
          <FormField testID="login-password-input" label="Contraseña" value={password} editable={!busy}
            onChangeText={(value) => { setPassword(value); setErrors({}); setMessage(''); }} error={errors.password}
            secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password"
            maxLength={128} returnKeyType="go" onSubmitEditing={() => void handleLogin()} />
          {message || sessionError ? <Text accessibilityRole="alert" style={styles.error}>{message || sessionError}</Text> : null}
          <Pressable testID="login-submit-button" accessibilityRole="button" accessibilityLabel="Ingresar"
            accessibilityState={{ disabled: busy, busy }} disabled={busy}
            style={[styles.button, busy && { opacity: 0.65 }]} onPress={() => void handleLogin()}>
            {busy && <ActivityIndicator color="#fff" />}
            <Text style={styles.buttonText}>{busy ? 'Ingresando…' : 'Ingresar'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { fontFamily: AppFonts.heading, fontSize: 24, color: Brand.text, marginBottom: 16 },
  error: { fontFamily: AppFonts.body, color: '#B91C1C', fontSize: 14 },
  button: { backgroundColor: Brand.primary, borderRadius: Radius.button, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  buttonText: { fontFamily: AppFonts.bodySemiBold, color: '#fff', fontSize: 16 },
});
