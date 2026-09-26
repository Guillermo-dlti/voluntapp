import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { AppFonts, Brand, Radius } from '@/constants/theme';

interface ButtonProps {
  label: string;
  // Shown while `busy`, so the button says what is happening ("Entrando…") instead of just spinning.
  busyLabel?: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}

export function Button({ label, busyLabel, onPress, busy = false, testID }: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.busy]}>
      {busy ? <ActivityIndicator color={Brand.surface} /> : null}
      <Text style={styles.label}>{busy && busyLabel ? busyLabel : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: Radius.button,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  pressed: { backgroundColor: Brand.primaryPressed },
  busy: { opacity: 0.75 },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 16, color: Brand.surface, letterSpacing: 0.2 },
});
