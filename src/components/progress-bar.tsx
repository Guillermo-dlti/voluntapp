import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing, Type } from '@/constants/theme';

interface ProgressBarProps {
  // "6 de 10 asignados": what's counted, in words, so the bar is never the only signal.
  label: string;
  // Quiet note on the right, such as "4 lugares libres".
  note?: string;
  value: number;
  max: number;
  tone?: 'primary' | 'attention';
  testID?: string;
}

// A count over a thin bar (after Posh's "1 scanned of 1"): capacity on Participantes, recorded people
// on Asistencia. Plain views, like the report charts.
export function ProgressBar({ label, note, value, max, tone = 'primary', testID }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={note ? `${label}. ${note}` : label}
      accessibilityValue={{ min: 0, max, now: value }} accessibilityLiveRegion="polite" style={styles.block}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tone === 'attention' ? Brand.accent : Brand.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  labels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: Spacing.md },
  label: { ...Type.headline, color: Brand.text },
  note: { ...Type.footnote, color: Brand.textSecondary },
  track: { height: 6, borderRadius: Radius.pill, backgroundColor: Brand.divider, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
