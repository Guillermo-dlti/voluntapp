import { ScrollView, StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';

interface FilterChipsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // true inside the forest header band, where the chips invert so the selected one still stands out.
  onDark?: boolean;
  testID?: string;
}

// Single-choice filter row (Activos, Inactivos, Todos). Scrolls sideways if the labels don't fit, out
// to the screen edge rather than stopping at the gutter, so a cut-off chip reads as "there's more".
export function FilterChips<T extends string>({ options, value, onChange, onDark = false, testID }: FilterChipsProps<T>) {
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}
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
  // Every screen pads its band and sheet by the gutter; the row steps out of it and pads itself instead.
  bleed: { marginHorizontal: -Spacing.gutter, flexGrow: 0 },
  row: { gap: Spacing.sm, paddingHorizontal: Spacing.gutter },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  selected: { backgroundColor: Brand.forest, borderColor: Brand.forest },
  label: { ...Type.calloutStrong, color: Brand.textSecondary },
  selectedLabel: { color: Brand.forestText },
  chipDark: { backgroundColor: 'transparent', borderColor: Brand.forestMuted },
  labelDark: { color: Brand.forestText },
  selectedDark: { backgroundColor: Brand.surface, borderColor: Brand.surface },
  selectedLabelDark: { color: Brand.forest },
});
