import { StyleSheet, Text, View } from 'react-native';

import { AppFonts, Brand, Radius } from '@/constants/theme';

export type BadgeTone = 'success' | 'neutral' | 'attention' | 'critical';

const tones: Record<BadgeTone, { background: string; dot: string; text: string }> = {
  success: { background: Brand.successLight, dot: Brand.success, text: Brand.primaryPressed },
  neutral: { background: Brand.surfaceMuted, dot: Brand.textTertiary, text: Brand.textSecondary },
  attention: { background: Brand.accentLight, dot: Brand.accent, text: Brand.accentText },
  critical: { background: Brand.dangerLight, dot: Brand.danger, text: Brand.dangerText },
};

// Tinted pill with a dot, so a status reads by color and by word (never color alone).
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const colors = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 12 },
});
