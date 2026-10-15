import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';

interface SegmentedTabsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

// Equal width tabs that switch the content below them (Detalles, Participantes, Asistencia).
// A white thumb on a muted track (after Luma and iOS segmented controls), so the selected tab never
// looks like the screen's green primary button.
// Built in React Native rather than the Compose segmented row, which makes a scroll view jump.
export function SegmentedTabs<T extends string>({ options, value, onChange, testID }: SegmentedTabsProps<T>) {
  return (
    <View testID={testID} accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale key={option.value} testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.selected]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.button,
    backgroundColor: Brand.surfaceMuted,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm, borderRadius: Radius.button - Spacing.xs },
  // Flat like every control: white on the muted track, outlined so it holds against the sheet.
  selected: { backgroundColor: Brand.surface, borderWidth: 1, borderColor: Brand.border },
  label: { ...Type.calloutStrong, color: Brand.textSecondary },
  selectedLabel: { color: Brand.text },
});
