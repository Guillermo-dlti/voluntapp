import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import { CURRENT_VOLUNTEER, MOCK_UPCOMING_ACTIVITIES } from '@/constants/mock-data';

export default function HomeHub() {
  const nextActivity = MOCK_UPCOMING_ACTIVITIES[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header: Greeting & Profile Avatar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola de nuevo,</Text>
            <Text style={styles.name}>{CURRENT_VOLUNTEER.name}</Text>
          </View>
          <Pressable
            style={styles.avatarCircle}
            onPress={() => router.push('/(tabs)/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Ir al perfil">
            <Text style={styles.avatarText}>CR</Text>
          </Pressable>
        </View>

        {/* Action Buttons / Navigation Cards */}
        <View style={styles.actionCards}>
          {/* Card 1: Buscar Oportunidades (Primary Highlight) */}
          <Pressable
            style={styles.primaryActionCard}
            onPress={() => router.push('/(tabs)/ofertas')}
            accessibilityRole="button">
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionIcon}>🔍</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.primaryActionText}>Buscar Oportunidades</Text>
              <Text style={styles.actionSubtext}>Encuentra turnos y vacantes disponibles</Text>
            </View>
            <Text style={styles.arrowIcon}>›</Text>
          </Pressable>

          {/* Card 2: Mis Actividades */}
          <Pressable
            style={styles.secondaryActionCard}
            onPress={() => router.push('/(tabs)/mis-actividades')}
            accessibilityRole="button">
            <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
              <Text style={styles.actionIcon}>📅</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.secondaryActionText}>Mis Actividades</Text>
              <Text style={styles.actionSubtext}>Consulta tus turnos programados</Text>
            </View>
            <Text style={styles.arrowIcon}>›</Text>
          </Pressable>

          {/* Card 3: Mi Impacto Social */}
          <Pressable
            style={styles.secondaryActionCard}
            onPress={() => router.push('/(tabs)/impacto')}
            accessibilityRole="button">
            <View style={[styles.actionIconCircle, { backgroundColor: Brand.primaryLight }]}>
              <Text style={styles.actionIcon}>🌱</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.secondaryActionText}>Mi Impacto Social</Text>
              <Text style={styles.actionSubtext}>Horas acumuladas y kg rescatados</Text>
            </View>
            <Text style={styles.arrowIcon}>›</Text>
          </Pressable>
        </View>

        {/* Quick Preview: Next Scheduled Activity */}
        {nextActivity && (
          <View style={styles.upcomingSection}>
            <Text style={styles.sectionTitle}>Próxima actividad</Text>
            <View style={styles.upcomingCard}>
              <View style={styles.badgeRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Confirmada</Text>
                </View>
                <Text style={styles.upcomingTime}>{nextActivity.dateText} • {nextActivity.timeText}</Text>
              </View>
              <Text style={styles.upcomingTitle}>{nextActivity.activityTitle}</Text>
              <Text style={styles.upcomingLocation}>📍 {nextActivity.location}</Text>

              <Pressable
                style={styles.checkInButton}
                onPress={() => router.push('/(tabs)/mis-actividades/check-in')}>
                <Text style={styles.checkInButtonText}>Ver Código Check-In</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  greeting: {
    fontFamily: AppFonts.body,
    fontSize: 14,
    color: Brand.textSecondary,
  },
  name: {
    fontFamily: AppFonts.heading,
    fontSize: 24,
    color: Brand.text,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill * 1.5,
    backgroundColor: Brand.primaryLight,
    borderWidth: 2,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.primary,
  },
  actionCards: {
    gap: 14,
  },
  primaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.primaryLight,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  secondaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionContent: {
    flex: 1,
  },
  primaryActionText: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.primary,
  },
  secondaryActionText: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  actionSubtext: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 22,
    color: Brand.textSecondary,
    fontWeight: '600',
  },
  upcomingSection: {
    gap: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 18,
    color: Brand.text,
  },
  upcomingCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    backgroundColor: Brand.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statusBadgeText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 11,
    color: Brand.primary,
  },
  upcomingTime: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  upcomingTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  upcomingLocation: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  checkInButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  checkInButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 14,
    color: '#ffffff',
  },
});