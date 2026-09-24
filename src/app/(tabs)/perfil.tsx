import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { authMessage } from '@/services/auth';

const roleNames = { volunteer: 'Voluntario', bamx_admin: 'Administrador BAMX', technical_admin: 'Administrador técnico' };

export default function PerfilScreen() {
  const { user, signOut, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
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
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const details = [
    ['Nombre de usuario', user.username], ['Correo electrónico', user.email],
    ['Teléfono de contacto', user.phone || 'No registrado'],
  ];
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <View style={styles.avatarLarge}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{roleNames[user.role]}</Text></View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la cuenta</Text>
          <View style={styles.card}>
            {details.map(([label, value], index) => <View key={label} style={{ gap: 12 }}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
              </View>
            </View>)}
          </View>
        </View>
        {message ? <Text accessibilityRole="alert" style={{ color: '#B91C1C' }}>{message}</Text> : null}
        <Pressable style={[styles.logoutButton, busy && { opacity: 0.65 }]} disabled={busy}
          onPress={() => void handleLogout()} accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }} accessibilityLabel="Cerrar sesión">
          {busy && <ActivityIndicator color="#DC2626" />}
          <Text style={styles.logoutButtonText}>{busy ? 'Cerrando sesión…' : 'Cerrar Sesión'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  profileHero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Brand.primaryLight,
    borderWidth: 2.5,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontFamily: AppFonts.heading,
    fontSize: 28,
    color: Brand.primary,
  },
  name: {
    fontFamily: AppFonts.heading,
    fontSize: 22,
    color: Brand.text,
  },
  roleBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  roleText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  infoValue: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 15,
    color: Brand.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FEF2F2',
  },
  logoutButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#DC2626',
    fontSize: 16,
  },
});