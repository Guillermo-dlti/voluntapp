import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Type } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'critical';

export interface ButtonProps {
  label: string;
  // Shown while `busy`, so the button says what is happening ("Entrando…") instead of just spinning.
  busyLabel?: string;
  onPress: () => void;
  busy?: boolean;
  // Nothing to act on yet (such as exporting an empty list); dimmed and not pressable.
  disabled?: boolean;
  // primary: the screen's main action. secondary: bordered, for everything else. critical: deactivate/cancel.
  variant?: ButtonVariant;
  icon?: Parameters<typeof Icon>[0]['name'];
  testID?: string;
}

const variants: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: Brand.primary, border: Brand.primary, text: Brand.surface },
  secondary: { background: Brand.surface, border: Brand.border, text: Brand.text },
  critical: { background: Brand.surface, border: Brand.dangerBorder, text: Brand.dangerText },
};

export function Button({ label, busyLabel, onPress, busy = false, disabled = false, variant = 'primary', icon, testID }: ButtonProps) {
  const colors = variants[variant];
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.background, borderColor: colors.border }, busy && styles.busy, disabled && !busy && styles.disabled]}>
      {busy ? <ActivityIndicator color={colors.text} /> : icon ? <Icon name={icon} size={20} color={colors.text} /> : null}
      <Text style={[styles.label, { color: colors.text }]}>{busy && busyLabel ? busyLabel : label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: Radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  busy: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  label: { ...Type.bodyStrong, letterSpacing: 0.2 },
});
