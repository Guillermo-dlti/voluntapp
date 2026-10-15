import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface SegmentedTabsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}

// Equal width tabs that switch the content below them (Detalles, Participantes, Asistencia).
// Built in React Native rather than the Compose segmented row, which makes a scroll view jump.
export function SegmentedTabs<T extends string>({ options, value, onChange, testID }: SegmentedTabsProps<T>) {
  return (
    <View testID={testID} accessibilityRole="tablist" style={styles.row}>
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
  row: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: Radius.button - 4 },
  selected: { backgroundColor: Brand.primary },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary },
  selectedLabel: { color: Brand.surface },
});
