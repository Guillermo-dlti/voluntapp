import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Brand, Type } from '@/constants/theme';
import { useReportExport } from '@/hooks/use-report-export';
import type { ReportKind } from '@/services/reports';
import type { ReportRange } from '@/utils/report-range';

interface ExportActionsProps {
  kind: ReportKind;
  range: ReportRange;
  // Rows in the list; there is nothing to export when it's 0.
  total: number;
  testID?: string;
}

export function ExportActions({ kind, range, total, testID }: ExportActionsProps) {
  const { busy, message, run } = useReportExport(range);

  const empty = total === 0;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.action}>
          <Button testID={testID ? `${testID}-download` : undefined} label="Descargar" busyLabel="Guardando…" variant="secondary"
            icon={{ ios: 'arrow.down.circle', android: 'download' }} busy={busy === 'download'} disabled={empty || busy === 'share'}
            onPress={() => { void run(kind, 'download'); }} />
        </View>
        <View style={styles.action}>
          <Button testID={testID ? `${testID}-share` : undefined} label="Compartir" busyLabel="Preparando…" variant="secondary"
            icon={{ ios: 'square.and.arrow.up', android: 'share' }} busy={busy === 'share'} disabled={empty || busy === 'download'}
            onPress={() => { void run(kind, 'share'); }} />
        </View>
      </View>
      <ExportMessage message={message} empty={empty} />
    </View>
  );
}

// The line under export buttons: the last result, else what pressing them gives.
export function ExportMessage({ message, empty }: { message: { text: string; error: boolean } | null; empty: boolean }) {
  return message ? <Text accessibilityRole={message.error ? 'alert' : undefined} accessibilityLiveRegion="polite"
    style={message.error ? styles.error : styles.hint}>{message.text}</Text>
    : empty ? <Text style={styles.hint}>No hay filas que exportar en este periodo.</Text>
      : <Text style={styles.hint}>Archivo CSV para Excel, con los datos de este periodo.</Text>;
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  error: { ...Type.callout, color: Brand.dangerText, textAlign: 'center' },
  hint: { ...Type.footnote, color: Brand.textSecondary, textAlign: 'center' },
});
