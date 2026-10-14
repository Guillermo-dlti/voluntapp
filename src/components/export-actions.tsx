import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { downloadReport, shareReport, type ReportKind } from '@/services/reports';
import type { ReportRange } from '@/utils/report-range';

interface ExportActionsProps {
  kind: ReportKind;
  range: ReportRange;
  // Rows in the list; there is nothing to export when it's 0.
  total: number;
  testID?: string;
}

type Action = 'download' | 'share';

// The CSV is always built by the server. "Descargar" saves it in a folder staff pick on the phone;
// "Compartir" opens the share sheet (Drive, Gmail, WhatsApp) from the app's private cache.
export function ExportActions({ kind, range, total, testID }: ExportActionsProps) {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (action: Action) => {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'share') await shareReport(kind, range);
      else if (await downloadReport(kind, range)) setMessage({ text: 'Listo. Guardamos el archivo CSV en la carpeta que elegiste.', error: false });
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage({ text: apiMessage(cause), error: true });
    } finally {
      setBusy(null);
    }
  };

  const empty = total === 0;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.action}>
          <Button testID={testID ? `${testID}-download` : undefined} label="Descargar" busyLabel="Guardando…" variant="secondary"
            icon={{ ios: 'arrow.down.circle', android: 'download' }} busy={busy === 'download'} disabled={empty || busy === 'share'}
            onPress={() => { void run('download'); }} />
        </View>
        <View style={styles.action}>
          <Button testID={testID ? `${testID}-share` : undefined} label="Compartir" busyLabel="Preparando…" variant="secondary"
            icon={{ ios: 'square.and.arrow.up', android: 'share' }} busy={busy === 'share'} disabled={empty || busy === 'download'}
            onPress={() => { void run('share'); }} />
        </View>
      </View>
      {message ? <Text accessibilityRole={message.error ? 'alert' : undefined} accessibilityLiveRegion="polite"
        style={message.error ? styles.error : styles.hint}>{message.text}</Text>
        : empty ? <Text style={styles.hint}>No hay filas que exportar en este periodo.</Text>
          : <Text style={styles.hint}>Archivo CSV para Excel, con los datos de este periodo.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  error: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, textAlign: 'center' },
  hint: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textSecondary, textAlign: 'center' },
});
