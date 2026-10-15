import { StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius } from '@/constants/theme';

interface IconButtonProps {
  icon: Parameters<typeof Icon>[0]['name'];
  // Required: an icon alone says nothing to a screen reader ("Llamar a Ana López", "Más acciones").
  accessibilityLabel: string;
  onPress: () => void;
  // true inside the forest header band.
  onDark?: boolean;
  disabled?: boolean;
  testID?: string;
}

// A square, flat, bordered button with only an icon. 48 dp, the Android minimum touch target.
export function IconButton({ icon, accessibilityLabel, onPress, onDark = false, disabled = false, testID }: IconButtonProps) {
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, onDark && styles.dark, disabled && styles.disabled]}>
      <Icon name={icon} size={20} color={onDark ? Brand.forestText : Brand.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  dark: { backgroundColor: 'transparent', borderColor: Brand.forestMuted },
  disabled: { opacity: 0.45 },
});
