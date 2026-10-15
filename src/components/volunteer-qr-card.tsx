import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useFeedback } from '@/providers/feedback-provider';
import { ApiError, apiMessage } from '@/services/api';
import { regenerateCheckinToken, type Volunteer } from '@/services/volunteers';

interface VolunteerQrCardProps {
  volunteer: Volunteer;
  // Admin and coordinator; the API refuses anyone else anyway.
  canRegenerate: boolean;
  onChanged: (volunteer: Volunteer) => void;
}

const QR_SIZE = 200;

// The volunteer's check in QR. It encodes only their random token, so a screenshot or printed card
// carries no personal data; staff scan it from an activity's Asistencia tab.
export function VolunteerQrCard({ volunteer, canRegenerate, onChanged }: VolunteerQrCardProps) {
  const { refresh } = useAuth();
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const token = volunteer.checkinToken;

  async function regenerate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      onChanged(await regenerateCheckinToken(volunteer.id));
      setMessage('');
      feedback.toast(token ? 'Código nuevo listo. El anterior ya no funciona.' : 'Código listo.');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause, 'No pudimos generar el código. Inténtalo de nuevo.'));
    } finally { pending.current = false; setBusy(false); }
  }

  function confirmRegenerate() {
    // A volunteer without a token has nothing to lose, so only a replacement asks first.
    if (!token) { void regenerate(); return; }
    Alert.alert(
      '¿Generar un código nuevo?',
      `El código actual de ${volunteer.firstName} deja de funcionar en cuanto generes el nuevo. Úsalo si perdió su tarjeta o alguien más la tiene.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Generar nuevo', style: 'destructive', onPress: () => void regenerate() },
      ],
    );
  }

  return (
    <Card testID="volunteer-qr-card">
      {token ? (
        <View style={styles.body}>
          <View style={styles.code} accessible accessibilityRole="image"
            accessibilityLabel={`Código QR de asistencia de ${volunteer.firstName} ${volunteer.lastName}`}>
            <QRCode value={token} size={QR_SIZE} color={Brand.text} backgroundColor={Brand.surface} quietZone={Spacing.md} ecl="M" />
          </View>
          <Text style={styles.caption}>
            Muéstralo en la entrada de una actividad para registrar su asistencia. No contiene datos personales.
          </Text>
        </View>
      ) : (
        <Text testID="volunteer-qr-missing" style={styles.caption}>Este voluntario aún no tiene código QR.</Text>
      )}
      {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}
      {canRegenerate ? (
        <View style={styles.action}>
          <Button testID="volunteer-qr-regenerate" label={token ? 'Generar nuevo código' : 'Generar código'} busyLabel="Generando…"
            busy={busy} variant="secondary" icon={{ ios: 'qrcode', android: 'qr_code_2' }} onPress={confirmRegenerate} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: Spacing.md },
  code: { borderRadius: Radius.tile, overflow: 'hidden' },
  caption: { ...Type.footnote, color: Brand.textSecondary, textAlign: 'center' },
  action: { marginTop: Spacing.lg },
  alert: { marginTop: Spacing.md, backgroundColor: Brand.dangerLight, borderRadius: Radius.tile, paddingVertical: Spacing.md, paddingHorizontal: 14 },
  alertText: { ...Type.callout, color: Brand.dangerText },
});
