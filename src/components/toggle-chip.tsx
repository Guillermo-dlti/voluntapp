import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface ToggleChipProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

// An on/off filter in the forest band, styled like FilterChips (onDark) with a check when on.
export function ToggleChip({ label, value, onChange, testID }: ToggleChipProps) {
  return (
    <View style={styles.wrap}>
      <PressableScale testID={testID} accessibilityRole="switch" accessibilityLabel={label}
        accessibilityState={{ checked: value, selected: value }} onPress={() => onChange(!value)}
        style={[styles.chip, value && styles.on]}>
        {value ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={16} color={Brand.forest} /> : null}
        <Text style={[styles.label, value && styles.labelOn]}>{label}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
  chip: {
    minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Brand.forestMuted, backgroundColor: 'transparent',
  },
  on: { backgroundColor: Brand.surface, borderColor: Brand.surface },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.forestText },
  labelOn: { color: Brand.forest },
});
