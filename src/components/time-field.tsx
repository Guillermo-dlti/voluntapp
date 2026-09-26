import { Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { formatTime } from '@/utils/time';

interface TimeFieldProps {
  label: string;
  // HH:MM wall clock time, or '' for none.
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  // Where the dial opens when there is no value yet.
  start: string;
  testID?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

// The Material time picker dialog, like DateField's. The native picker reads and reports hours in
// the phone's own zone, so both directions go through a local Date; only the hour and minute matter.
export function TimeField({ label, value, onChange, error, hint, start, testID }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = (value || start).split(':').map(Number);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatTime(value) : 'sin hora'}`}
        accessibilityHint={error ?? hint} onPress={() => setOpen(true)}
        style={[styles.input, open && styles.focused, error ? styles.invalid : undefined]}>
        <Icon name={{ ios: 'clock', android: 'schedule' }} size={20} color={Brand.textSecondary} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatTime(value) : 'Sin hora'}</Text>
      </Pressable>
      {open ? (
        <Host style={styles.dialogHost}>
          <TimePickerDialog
            is24Hour={false}
            initialDate={new Date(2000, 0, 1, hour, minute).toISOString()}
            color={Brand.primary}
            confirmButtonLabel="Usar hora"
            dismissButtonLabel="Cancelar"
            onDateSelected={(date) => { onChange(`${pad(date.getHours())}:${pad(date.getMinutes())}`); setOpen(false); }}
            onDismissRequest={() => setOpen(false)}
          />
        </Host>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.text },
  input: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    backgroundColor: Brand.surfaceMuted,
  },
  focused: { borderColor: Brand.primary, backgroundColor: Brand.surface },
  invalid: { borderColor: Brand.danger, backgroundColor: Brand.dangerLight },
  value: { flex: 1, fontFamily: AppFonts.body, fontSize: 16, color: Brand.text },
  placeholder: { color: Brand.textTertiary },
  dialogHost: { position: 'absolute', width: 0, height: 0 },
  error: { fontFamily: AppFonts.body, color: Brand.dangerText, fontSize: 13 },
  hint: { fontFamily: AppFonts.body, color: Brand.textSecondary, fontSize: 13 },
});
