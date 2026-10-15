import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { AppFonts, Brand } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  // Small gray word right after the number, such as "horas".
  unit?: string;
  // Context under the number, such as "finalizadas".
  caption?: string;
  icon: Parameters<typeof Icon>[0]['name'];
  // 'attention' tints the label mango, for a count that is waiting on someone.
  tone?: 'default' | 'attention';
  testID?: string;
}

// One key number, after Apple Health's summary cards: a small tinted label says what it is, the number
// itself stays near black so color never competes with the value. Two side by side make a KPI strip.
export function StatCard({ label, value, unit, caption, icon, tone = 'default', testID }: StatCardProps) {
  const tint = tone === 'attention' ? Brand.accentText : Brand.primary;
  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.top}>
        <Icon name={icon} size={16} color={tint} />
        <Text style={[styles.label, { color: tint }]} numberOfLines={2}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  label: { flex: 1, fontFamily: AppFonts.bodySemiBold, fontSize: 14 },
  // Pinned to the bottom, so two cards side by side keep their numbers on one line even when one label wraps.
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 'auto' },
  value: { fontFamily: AppFonts.headingSemiBold, fontSize: 34, lineHeight: 38, color: Brand.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: AppFonts.bodySemiBold, fontSize: 15, color: Brand.textSecondary },
  caption: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textTertiary, marginTop: 2 },
});
