import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { authMessage } from '@/services/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn, error: sessionError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const passwordRef = useRef<TextInput>(null);

  function clearFeedback() { setErrors({}); setMessage(''); }

  async function handleLogin() {
    if (pending.current) return;
    const trimmed = email.trim();
    const invalid = {
      ...(!emailPattern.test(trimmed) || trimmed.length > 254 ? { email: 'Escribe un correo válido, por ejemplo nombre@bamx.org.mx.' } : {}),
      ...(!password || password.length > 128 ? { password: 'Escribe tu contraseña.' } : {}),
    };
    setErrors(invalid);
    setMessage('');
    if (Object.keys(invalid).length) return;
    pending.current = true;
    setBusy(true);
    try { await signIn(trimmed, password); setPassword(''); }
    catch (cause: unknown) { setMessage(authMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }

  const alert = message || sessionError;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.band}>
        <Image source={require('@/assets/images/bamx-logo.png')} style={styles.logo} contentFit="contain"
          accessibilityLabel="Logotipo del Banco de Alimentos de Guadalajara" />
        <Text style={styles.org}>Banco de Alimentos de Guadalajara</Text>
        <Text style={styles.wordmark}>Voluntapp</Text>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>Inicia sesión</Text>
            <Text style={styles.subtitle}>Usa el correo y la contraseña de tu cuenta de personal.</Text>
          </View>

          <FormField testID="login-email-input" label="Correo" value={email} editable={!busy}
            onChangeText={(value) => { setEmail(value); clearFeedback(); }} error={errors.email}
            placeholder="nombre@bamx.org.mx" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            autoComplete="email" textContentType="username" maxLength={254}
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />
          <FormField ref={passwordRef} testID="login-password-input" label="Contraseña" value={password} editable={!busy}
            onChangeText={(value) => { setPassword(value); clearFeedback(); }} error={errors.password}
            secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password"
            textContentType="password" maxLength={128} returnKeyType="go" onSubmitEditing={() => void handleLogin()} />

          {alert ? (
            <View accessibilityRole="alert" style={styles.alert}>
              <Text style={styles.alertText}>{alert}</Text>
            </View>
          ) : null}

          <Button testID="login-submit-button" label="Entrar" busyLabel="Entrando…" busy={busy} onPress={() => void handleLogin()} />

          <Text style={styles.help}>¿No tienes cuenta? Pídela a una persona de Administración en BAMX.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.forest },
  band: { alignItems: 'flex-start', paddingHorizontal: 28, paddingBottom: 40, paddingTop: 28, gap: 6 },
  logo: { width: 56, height: 78, marginBottom: 14 },
  org: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.forestMuted },
  wordmark: { fontFamily: AppFonts.heading, fontSize: 40, color: Brand.forestText, letterSpacing: -1 },
  sheetWrap: { flex: 1 },
  sheet: { flex: 1, backgroundColor: Brand.surface, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet },
  sheetContent: { padding: 28, paddingBottom: 40, gap: 18, width: '100%', maxWidth: 520, alignSelf: 'center' },
  heading: { gap: 6, marginBottom: 6 },
  title: { fontFamily: AppFonts.heading, fontSize: 26, color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.textSecondary, lineHeight: 21 },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
  help: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
});
