import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';
import { CURRENT_VOLUNTEER } from '@/constants/mock-data';

export default function MiImpactoScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mi Impacto</Text>
          <Text style={styles.subtitle}>
            Tu esfuerzo transforma comunidades y rescata alimentos
          </Text>
        </View>

        {/* Hero Card: Horas Totales */}
        <View style={styles.heroCard}>
          <Text style={styles.heroNumber}>{CURRENT_VOLUNTEER.hoursTotal}</Text>
          <Text style={styles.heroLabel}>Horas Totales</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Nivel Plata • Voluntario Constante</Text>
          </View>
        </View>

        {/* 2-Column Metrics */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{CURRENT_VOLUNTEER.completedServices}</Text>
            <Text style={styles.statLabel}>Servicios</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{CURRENT_VOLUNTEER.rescuedKg}kg</Text>
            <Text style={styles.statLabel}>Rescatados</Text>
          </View>
        </View>

        {/* Social Equivalent Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equivalencia social estimada</Text>

          <View style={styles.equivalentsList}>
            <View style={styles.equivalentCard}>
              <Text style={styles.equivalentIcon}>🥗</Text>
              <View style={styles.equivalentContent}>
                <Text style={styles.equivalentValue}>~280 raciones</Text>
                <Text style={styles.equivalentText}>
                  De alimentos entregados a comedores comunitarios
                </Text>
              </View>
            </View>

            <View style={styles.equivalentCard}>
              <Text style={styles.equivalentIcon}>🌍</Text>
              <View style={styles.equivalentContent}>
                <Text style={styles.equivalentValue}>350 kg CO₂e</Text>
                <Text style={styles.equivalentText}>
                  Evitados mediante el rescate y aprovechamiento de alimento
                </Text>
              </View>
            </View>
          </View>
        </View>
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
    gap: 4,
    paddingTop: 8,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 24,
    color: Brand.text,
  },
  subtitle: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  heroCard: {
    backgroundColor: Brand.primaryLight,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderRadius: Radius.card,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  heroNumber: {
    fontFamily: AppFonts.heading,
    fontSize: 56,
    color: Brand.primary,
    lineHeight: 64,
  },
  heroLabel: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 17,
    color: Brand.text,
  },
  heroBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  heroBadgeText: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 12,
    color: Brand.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontFamily: AppFonts.heading,
    fontSize: 28,
    color: Brand.text,
  },
  statLabel: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  equivalentsList: {
    gap: 12,
  },
  equivalentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
  },
  equivalentIcon: {
    fontSize: 26,
  },
  equivalentContent: {
    flex: 1,
    gap: 2,
  },
  equivalentValue: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 15,
    color: Brand.text,
  },
  equivalentText: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
    lineHeight: 16,
  },
});