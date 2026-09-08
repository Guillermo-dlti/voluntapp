import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';

export default function RegistrationConfirmation() {
  const { title } = useLocalSearchParams<{ title?: string }>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.checkmarkIcon}>✓</Text>
        </View>

        <Text style={styles.title}>¡Registro Exitoso!</Text>

        <Text style={styles.subtitle}>
          Tu plaza para <Text style={styles.boldText}>{title || 'la actividad'}</Text> ha sido confirmada. Revisa los detalles en &quot;Mis Actividades&quot;.
        </Text>

        <View style={styles.buttonGroup}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/mis-actividades')}
            accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Ir a Mis Actividades</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)/ofertas')}
            accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Ver más oportunidades</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Brand.primaryLight,
    borderWidth: 2.5,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  checkmarkIcon: {
    fontSize: 44,
    color: Brand.primary,
    fontWeight: 'bold',
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 24,
    color: Brand.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: AppFonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textSecondary,
    textAlign: 'center',
    maxWidth: 290,
  },
  boldText: {
    fontFamily: AppFonts.bodySemiBold,
    color: Brand.text,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#ffffff',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: Brand.textSecondary,
    fontSize: 16,
  },
});
