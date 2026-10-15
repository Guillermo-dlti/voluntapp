import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SkeletonVolunteerDetail } from '@/components/skeleton';
import { VolunteerIdCard } from '@/components/volunteer-id-card';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { printVolunteerCard } from '@/services/volunteer-card';
import { getVolunteer, type Volunteer } from '@/services/volunteers';

// Preview of the volunteer's printable card, then the system print dialog (a printer, or a PDF to print later).
export default function VolunteerCardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [message, setMessage] = useState('');
  const [printError, setPrintError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    try {
      setVolunteer((await getVolunteer(id)).volunteer);
      setMessage('');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
    }
  }, [id, refresh]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const token = volunteer?.checkinToken;

  async function print() {
    if (pending.current || !volunteer || !token) return;
    pending.current = true;
    setBusy(true);
    setPrintError('');
    try {
      await printVolunteerCard({ firstName: volunteer.firstName, lastName: volunteer.lastName, checkinToken: token });
    } catch {
      setPrintError('No pudimos abrir la impresión. Revisa que haya una impresora disponible e inténtalo de nuevo.');
    } finally { pending.current = false; setBusy(false); }
  }

  if (!volunteer) {
    return (
      <Screen testID="volunteer-card-screen" title="Tarjeta" onBack={() => router.back()}>
        {message ? (
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'error' }} title="No pudimos abrir la tarjeta" body={message}
            action={{ label: 'Reintentar', onPress: () => void load() }} />
        ) : <SkeletonVolunteerDetail />}
      </Screen>
    );
  }

  return (
    <Screen testID="volunteer-card-screen" title="Tarjeta" subtitle={`${volunteer.firstName} ${volunteer.lastName}`} onBack={() => router.back()}
      footer={token ? (
        <Button testID="volunteer-card-print" label="Imprimir tarjeta" busyLabel="Preparando…" busy={busy}
          icon={{ ios: 'printer', android: 'print' }} onPress={() => void print()} />
      ) : undefined}>
      {token ? (
        <View style={styles.preview}>
          <VolunteerIdCard holder={{ firstName: volunteer.firstName, lastName: volunteer.lastName, checkinToken: token }} />
          <Text style={styles.caption}>
            Se imprime a tamaño credencial (5.4 × 8.6 cm) con una línea punteada para recortarla. También puedes guardarla como PDF desde la impresión.
          </Text>
          {printError ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{printError}</Text></View> : null}
        </View>
      ) : (
        <EmptyState icon={{ ios: 'qrcode', android: 'qr_code_2' }} title="Aún no tiene código"
          body="Genera su código QR en su registro para poder imprimir la tarjeta." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { gap: Spacing.xl, paddingTop: Spacing.sm },
  caption: { ...Type.footnote, color: Brand.textSecondary, textAlign: 'center' },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: Radius.tile, paddingVertical: Spacing.md, paddingHorizontal: 14 },
  alertText: { ...Type.callout, color: Brand.dangerText },
});
