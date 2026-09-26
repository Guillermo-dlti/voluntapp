import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { roleCan, roleLabels } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { authMessage } from '@/services/auth';

export default function SettingsScreen() {
  const { user, signOut, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  // Re-check the session when the tab opens, so a deactivated account is signed out promptly.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function handleLogout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try { await signOut(); }
    catch (cause: unknown) { setMessage(authMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }

  if (!user) return null;
  const isAdmin = roleCan.manageStaff(user.role);

  return (
    <Screen testID="settings-screen" title="Ajustes" band={
      <View style={styles.profile}>
        <Avatar name={user.fullName} size={56} />
        <View style={styles.profileText}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </View>
    }>
      <View testID="settings-account-section">
        <Section title="Cuenta">
          <Row icon={{ ios: 'envelope', android: 'mail' }} label="Correo" value={user.email} />
          <Row icon={{ ios: 'person.badge.key', android: 'badge' }} label="Rol" value={roleLabels[user.role]} />
        </Section>
      </View>

      {isAdmin ? (
        <Section title="Administración" footer="Solo las cuentas de Administración ven esta sección.">
          <Row icon={{ ios: 'person.3', android: 'manage_accounts' }} label="Personal" note="Próximamente" />
          <Row icon={{ ios: 'clock.arrow.circlepath', android: 'history' }} label="Bitácora de auditoría" note="Próximamente" />
        </Section>
      ) : null}

      <Section footer={message || undefined}>
        <Row testID="logout-button" icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout' }}
          label={busy ? 'Cerrando sesión…' : 'Cerrar sesión'} destructive disabled={busy} onPress={() => void handleLogout()} />
      </Section>

      <Text style={styles.version}>Voluntapp {Constants.expoConfig?.version ?? ''}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileText: { flex: 1, gap: 2 },
  name: { fontFamily: AppFonts.headingSemiBold, fontSize: 19, color: Brand.forestText },
  email: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.forestMuted },
  version: { fontFamily: AppFonts.body, fontSize: 12, color: Brand.textTertiary, textAlign: 'center' },
});
