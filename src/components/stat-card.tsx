import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { AppFonts, Brand } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  // Unit or context under the number, such as "horas finalizadas".
  caption?: string;
  icon: Parameters<typeof Icon>[0]['name'];
  testID?: string;
}

// One key number, large, in Outfit. Put two side by side in a row for a KPI strip.
export function StatCard({ label, value, caption, icon, testID }: StatCardProps) {
  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.iconWell}><Icon name={icon} size={16} color={Brand.primary} /></View>
      </View>
      <Text style={styles.value}>{value}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flex: 1, fontFamily: AppFonts.bodySemiBold, fontSize: 13, color: Brand.textSecondary },
  iconWell: { width: 28, height: 28, borderRadius: 8, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: AppFonts.heading, fontSize: 32, color: Brand.text, letterSpacing: -0.8, marginTop: 10 },
  caption: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textTertiary, marginTop: 2 },
});
