import { StyleSheet, Text, View } from 'react-native';

import { RowMetrics } from '@/components/grouped-list';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';

interface PickerRowProps {
  label: string;
  // Already formatted ("15 de octubre de 2026", "9:00 a.m."), or '' when nothing is chosen.
  value: string;
  placeholder: string;
  onPress: () => void;
  open?: boolean;
  error?: string;
  testID?: string;
}

// A label with its chosen value in a tinted pill on the right, inside a grouped card, after WhatsApp's
// and Alexa's event forms: a date or time takes one 56 dp row instead of a labeled box. The value
// drops under the label at large text sizes.
export function PickerRow({ label, value, placeholder, onPress, open = false, error, testID }: PickerRowProps) {
  const largeText = useLargeText();
  return (
    <View>
      <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityHint={error} onPress={onPress} android_ripple={{ color: Brand.surfaceMuted }}
        style={[styles.row, largeText && styles.stacked]}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.pill, open && styles.pillOpen, error ? styles.pillInvalid : undefined]}>
          <Text style={[styles.value, !value && styles.placeholder, error ? styles.valueInvalid : undefined]}>{value || placeholder}</Text>
        </View>
      </PressableScale>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md,
    paddingHorizontal: RowMetrics.padding, paddingVertical: Spacing.sm,
  },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  label: { ...Type.body, color: Brand.text, flexShrink: 1 },
  pill: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: Radius.well, backgroundColor: Brand.surfaceMuted },
  pillOpen: { backgroundColor: Brand.primaryLight },
  pillInvalid: { backgroundColor: Brand.dangerLight },
  value: { ...Type.bodyStrong, color: Brand.text },
  placeholder: { color: Brand.textSecondary },
  valueInvalid: { color: Brand.dangerText },
  error: { ...Type.footnote, color: Brand.dangerText, paddingHorizontal: RowMetrics.padding, paddingBottom: Spacing.md },
});
