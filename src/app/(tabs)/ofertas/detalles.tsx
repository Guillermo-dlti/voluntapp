import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { MOCK_ACTIVITIES } from '@/constants/mock-data';

export default function OpportunityDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = MOCK_ACTIVITIES.find((a) => a.id === id) ?? MOCK_ACTIVITIES[1];

  function handleRegister() {
    router.push({
      pathname: '/(tabs)/ofertas/confirmacion',
      params: { title: activity.title },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <BackButton inline fallback="/(tabs)/ofertas" />

        {/* Banner / Category Placeholder */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>📦</Text>
          <Text style={styles.bannerBadge}>{activity.category}</Text>
        </View>

        {/* Title & Info */}
        <View style={styles.content}>
          <Text style={styles.title}>{activity.title}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📅</Text>
              <View>
                <Text style={styles.infoLabel}>Fecha</Text>
                <Text style={styles.infoValue}>{activity.date}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <View>
                <Text style={styles.infoLabel}>Lugar</Text>
                <Text style={styles.infoValue}>{activity.location}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⏰</Text>
              <View>
                <Text style={styles.infoLabel}>Horario</Text>
                <Text style={styles.infoValue}>{activity.time}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>👥</Text>
              <View>
                <Text style={styles.infoLabel}>Cupos disponibles</Text>
                <Text style={styles.infoValue}>
                  {activity.spotsLeft} de {activity.capacity} lugares
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.descriptionText}>{activity.description}</Text>
          </View>

          {/* Requirements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requisitos de asistencia</Text>
            <View style={styles.requirementsList}>
              {activity.requirements.map((req, index) => (
                <View key={index} style={styles.requirementItem}>
                  <Text style={styles.bullet}>✓</Text>
                  <Text style={styles.requirementText}>{req}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Registration CTA */}
        <Pressable
          style={styles.registerButton}
          onPress={handleRegister}
          accessibilityRole="button">
          <Text style={styles.registerButtonText}>Registrarse</Text>
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
    gap: 16,
  },
  banner: {
    height: 140,
    borderRadius: Radius.card,
    backgroundColor: Brand.primaryLight,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  bannerIcon: {
    fontSize: 48,
  },
  bannerBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#ffffff',
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 12,
    color: Brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  content: {
    gap: 20,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 22,
    color: Brand.text,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radius.card,
    borderWidth: 1.5,
    borderColor: Brand.border,
    padding: 16,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  infoLabel: {
    fontFamily: AppFonts.body,
    fontSize: 11,
    color: Brand.textSecondary,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 14,
    color: Brand.text,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.text,
  },
  descriptionText: {
    fontFamily: AppFonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: Brand.textSecondary,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    fontFamily: AppFonts.bodySemiBold,
    color: Brand.primary,
    fontSize: 14,
  },
  requirementText: {
    fontFamily: AppFonts.body,
    fontSize: 14,
    color: Brand.text,
  },
  registerButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  registerButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#ffffff',
    fontSize: 16,
  },
});
