import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Type } from '@/constants/theme';

export type BadgeTone = 'success' | 'neutral' | 'attention' | 'critical';

// Also used by charts, so a status has the same color everywhere.
export const badgeColors: Record<BadgeTone, { background: string; dot: string; text: string }> = {
  success: { background: Brand.successLight, dot: Brand.success, text: Brand.primaryPressed },
  neutral: { background: Brand.surfaceMuted, dot: Brand.textTertiary, text: Brand.textSecondary },
  attention: { background: Brand.accentLight, dot: Brand.accent, text: Brand.accentText },
  critical: { background: Brand.dangerLight, dot: Brand.danger, text: Brand.dangerText },
};

// Tinted pill with the status in words (never color alone). No dot: the tint already carries the color.
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const colors = badgeColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  label: { ...Type.caption },
});
