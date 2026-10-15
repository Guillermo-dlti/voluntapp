import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { checkIn, type CheckInOutcome } from '@/services/activities';
import { isCheckinToken, shouldHandleScan, type LastRead } from '@/utils/checkin';

type Tone = 'success' | 'attention' | 'error';

interface Banner {
  tone: Tone;
  message: string;
}

const tones: Record<CheckInOutcome, Tone> = {
  checked_in: 'success',
  already: 'attention',
  not_assigned: 'error',
  inactive: 'error',
  invalid: 'error',
  refused: 'error',
  offline: 'error',
};

const bannerIcons: Record<Tone, Parameters<typeof Icon>[0]['name']> = {
  success: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  attention: { ios: 'exclamationmark.circle.fill', android: 'info' },
  error: { ios: 'xmark.circle.fill', android: 'cancel' },
};

// Full screen QR scanner for one activity's attendance. It stays on the camera after every result, so
// staff can scan a whole line at the door; closing it returns to the roll call, which reloads on focus.
export default function ScannerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [counts, setCounts] = useState<{ recorded: number; assigned: number } | null>(null);
  // Refs, not state: the camera reports a code many times a second, faster than a render.
  const inFlight = useRef(false);
  const lastRead = useRef<LastRead | null>(null);

  function handleScan({ data }: BarcodeScanningResult) {
    const now = Date.now();
    if (!shouldHandleScan(data, now, inFlight.current, lastRead.current)) return;
    lastRead.current = { code: data, at: now };
    if (!isCheckinToken(data)) {
      setBanner({ tone: 'error', message: 'Código no válido' });
      return;
    }
    inFlight.current = true;
    setWaiting(true);
    void checkIn(id, data)
      .then((result) => {
        setBanner({ tone: tones[result.outcome], message: result.message });
        if (result.counts) setCounts(result.counts);
        // Forget a code that never reached the server, so holding it up again retries at once.
        lastRead.current = result.outcome === 'offline' ? null : { code: data, at: Date.now() };
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
        setBanner({ tone: 'error', message: apiMessage(cause, 'No pudimos registrar el código. Vuelve a escanear.') });
        lastRead.current = null;
      })
      .finally(() => { inFlight.current = false; setWaiting(false); });
  }

  const close = (
    <IconButton testID="scanner-close" icon={{ ios: 'xmark', android: 'close' }} accessibilityLabel="Cerrar escáner"
      onDark onPress={() => router.back()} />
  );

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <View testID="scanner-permission" style={[styles.screen, styles.permission, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.topBar}>{close}</View>
        <View style={styles.permissionBody}>
          <Icon name={{ ios: 'camera', android: 'photo_camera' }} size={40} color={Brand.forestText} />
          <Text accessibilityRole="header" style={styles.permissionTitle}>Usa la cámara para escanear</Text>
          <Text style={styles.permissionText}>
            {blocked
              ? 'El permiso de cámara está desactivado. Actívalo en los ajustes del teléfono para escanear los códigos QR de los voluntarios.'
              : 'VoluntApp usa la cámara solo para leer el código QR de cada voluntario y registrar su asistencia. No guarda fotos ni video.'}
          </Text>
        </View>
        <Button testID="scanner-permission-action" label={blocked ? 'Abrir ajustes' : 'Permitir cámara'}
          icon={blocked ? { ios: 'gear', android: 'settings' } : { ios: 'camera', android: 'photo_camera' }}
          onPress={() => { if (blocked) void Linking.openSettings(); else void requestPermission(); }} />
      </View>
    );
  }

  return (
    <View testID="scanner-screen" style={styles.screen}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleScan} />

      <View style={[styles.topBar, styles.overlayTop, { paddingTop: insets.top + Spacing.md }]}>
        {close}
        <Text accessibilityRole="header" style={styles.title}>Escanear asistencia</Text>
        <IconButton testID="scanner-torch" icon={torch ? { ios: 'flashlight.on.fill', android: 'flashlight_on' } : { ios: 'flashlight.off.fill', android: 'flashlight_off' }}
          accessibilityLabel={torch ? 'Apagar linterna' : 'Encender linterna'} onDark onPress={() => setTorch((on) => !on)} />
      </View>

      <View pointerEvents="none" style={styles.frameArea}>
        <View style={styles.frame} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View testID="scanner-banner" accessibilityRole="alert" accessibilityLiveRegion="polite"
          style={[styles.banner, banner ? styles[banner.tone] : styles.idle]}>
          {waiting ? <ActivityIndicator color={Brand.surface} accessibilityLabel="Registrando" />
            : banner ? <Icon name={bannerIcons[banner.tone]} size={24} color={banner.tone === 'attention' ? Brand.text : Brand.surface} /> : null}
          <Text style={[styles.bannerText, banner?.tone === 'attention' && styles.bannerTextDark]}>
            {waiting ? 'Registrando…' : banner?.message ?? 'Apunta la cámara al código QR del voluntario.'}
          </Text>
        </View>
        {counts ? (
          <Text testID="scanner-count" style={styles.count}>{`${counts.recorded} de ${counts.assigned} registrados`}</Text>
        ) : null}
      </View>
    </View>
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.forest },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingHorizontal: Spacing.gutter },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: Spacing.md, backgroundColor: Brand.scrim },
  title: { ...Type.headline, color: Brand.forestText, flex: 1, textAlign: 'center' },
  frameArea: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE, borderRadius: Radius.card, borderWidth: 3, borderColor: Brand.surface },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.sm, paddingHorizontal: Spacing.gutter },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 64, borderRadius: Radius.card, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  idle: { backgroundColor: Brand.scrimStrong },
  success: { backgroundColor: Brand.primary },
  attention: { backgroundColor: Brand.accent },
  error: { backgroundColor: Brand.danger },
  bannerText: { ...Type.bodyStrong, color: Brand.surface, flex: 1 },
  bannerTextDark: { color: Brand.text },
  count: { ...Type.calloutStrong, color: Brand.surface, textAlign: 'center', textShadowColor: Brand.scrimStrong, textShadowRadius: 4 },
  permission: { justifyContent: 'space-between', paddingHorizontal: Spacing.gutter },
  permissionBody: { alignItems: 'center', gap: Spacing.md },
  permissionTitle: { ...Type.title, color: Brand.forestText, textAlign: 'center' },
  permissionText: { ...Type.body, color: Brand.forestMuted, textAlign: 'center' },
});
