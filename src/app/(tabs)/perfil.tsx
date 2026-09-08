import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import { CURRENT_VOLUNTEER } from '@/constants/mock-data';

export default function PerfilScreen() {
  function handleLogout() {
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header / Avatar Profile */}
        <View style={styles.profileHero}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>CR</Text>
          </View>
          <Text style={styles.name}>{CURRENT_VOLUNTEER.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{CURRENT_VOLUNTEER.role}</Text>
          </View>
        </View>

        {/* Account Info Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la cuenta</Text>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Correo electrónico</Text>
              <Text style={styles.infoValue}>{CURRENT_VOLUNTEER.email}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Teléfono de contacto</Text>
              <Text style={styles.infoValue}>{CURRENT_VOLUNTEER.phone}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sede asignada</Text>
              <Text style={styles.infoValue}>BAMX Guadalajara Central</Text>
            </View>
          </View>
        </View>

        {/* Participation Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen de voluntariado</Text>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Horas acumuladas</Text>
              <Text style={[styles.infoValue, { color: Brand.primary }]}>
                {CURRENT_VOLUNTEER.hoursTotal} hrs
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Actividades concluidas</Text>
              <Text style={styles.infoValue}>
                {CURRENT_VOLUNTEER.completedServices} servicios
              </Text>
            </View>
          </View>
        </View>

        {/* Logout Action */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión">
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
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