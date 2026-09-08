import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        {/* Icon circle: primaryLight bg, primary border, comes from the figma template */}
        <View style={styles.iconCircle}>
          <Text style={styles.heartIcon}>logo</Text>
        </View>
        <Text style={styles.title}>Banco de Alimentos</Text>
        <Text style={styles.subtitle}>Plataforma de Voluntarios</Text>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.secondaryButtonText}>Registrarse</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
    gap: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill * 1.4, // scaled up from Figma's 40px mock to a real touch-friendly size
    backgroundColor: Brand.primaryLight,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heartIcon: {
    fontSize: 24,
    color: Brand.primary,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 20,
    color: Brand.text,
  },
  subtitle: {
    fontFamily: AppFonts.body,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  buttonGroup: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#fff',
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