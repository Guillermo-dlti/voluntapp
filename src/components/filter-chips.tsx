import { ScrollView, StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface FilterChipsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // true inside the forest header band, where the chips invert so the selected one still stands out.
  onDark?: boolean;
  testID?: string;
}

// Single-choice filter row (Activos, Inactivos, Todos). Scrolls sideways if the labels don't fit.
export function FilterChips<T extends string>({ options, value, onChange, onDark = false, testID }: FilterChipsProps<T>) {
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
      accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale key={option.value} testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
            style={[styles.chip, onDark && styles.chipDark, selected && (onDark ? styles.selectedDark : styles.selected)]}>
            <Text style={[styles.label, onDark && styles.labelDark, selected && (onDark ? styles.selectedLabelDark : styles.selectedLabel)]}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  selected: { backgroundColor: Brand.forest, borderColor: Brand.forest },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary },
  selectedLabel: { color: Brand.forestText },
  chipDark: { backgroundColor: 'transparent', borderColor: Brand.forestMuted },
  labelDark: { color: Brand.forestText },
  selectedDark: { backgroundColor: Brand.surface, borderColor: Brand.surface },
  selectedLabelDark: { color: Brand.forest },
});
