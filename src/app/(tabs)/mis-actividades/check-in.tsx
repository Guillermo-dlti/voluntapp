import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { QRCodeGraphic } from '@/components/qr-code';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { CURRENT_VOLUNTEER } from '@/constants/mock-data';

export default function CheckInScreen() {
  const { title, code } = useLocalSearchParams<{ title?: string; code?: string }>();

  const displayTitle = title || 'Clasificación de Alimentos';
  const displayCode = code || 'BAMX-CR-20261014-01';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <BackButton inline fallback="/(tabs)/mis-actividades" />

        <View style={styles.content}>
          <Text style={styles.title}>Confirmar Asistencia</Text>

          <Text style={styles.activityName}>{displayTitle}</Text>

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <QRCodeGraphic size={210} />
          </View>

          <Text style={styles.instruction}>
            Muestra este código al llegar para registrar tus horas
          </Text>

          {/* Volunteer Identifier Badge */}
          <View style={styles.idCard}>
            <View style={styles.idRow}>
              <Text style={styles.idLabel}>Voluntario:</Text>
              <Text style={styles.idValue}>{CURRENT_VOLUNTEER.name}</Text>
            </View>
            <View style={styles.idRow}>
              <Text style={styles.idLabel}>Folio de pase:</Text>
              <Text style={styles.idCode}>{displayCode}</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 22,
    color: Brand.text,
    textAlign: 'center',
  },
  activityName: {
    fontFamily: AppFonts.headingSemiBold,
    fontSize: 16,
    color: Brand.primary,
    textAlign: 'center',
  },
  qrWrapper: {
    marginVertical: 12,
  },
  instruction: {
    fontFamily: AppFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
  idCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
    width: '100%',
    maxWidth: 280,
    marginTop: 8,
  },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idLabel: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    color: Brand.textSecondary,
  },
  idValue: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 13,
    color: Brand.text,
  },
  idCode: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 12,
    color: Brand.primary,
  },
});
