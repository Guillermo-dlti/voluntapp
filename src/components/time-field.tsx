import { Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fieldBox } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { PickerRow } from '@/components/picker-row';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Spacing, Type } from '@/constants/theme';
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
  // 'row' inside a grouped card (the activity schedule); 'field' is a labeled box like FormField.
  variant?: 'field' | 'row';
  testID?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

// The Material time picker dialog, like DateField's. The native picker reads and reports hours in
// the phone's own zone, so both directions go through a local Date; only the hour and minute matter.
export function TimeField({ label, value, onChange, error, hint, start, variant = 'field', testID }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = (value || start).split(':').map(Number);
  const dialog = open ? (
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
  ) : null;

  if (variant === 'row') {
    return (
      <>
        <PickerRow testID={testID} label={label} value={value ? formatTime(value) : ''} placeholder="Elegir hora"
          open={open} error={error} onPress={() => setOpen(true)} />
        {dialog}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatTime(value) : 'sin hora'}`}
        accessibilityHint={error ?? hint} onPress={() => setOpen(true)}
        style={[styles.box, styles.inside, open && styles.focused, error ? styles.invalid : undefined]}>
        <Icon name={{ ios: 'clock', android: 'schedule' }} size={20} color={Brand.textSecondary} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatTime(value) : 'Sin hora'}</Text>
      </PressableScale>
      {dialog}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  ...fieldBox,
  inside: { gap: 10, paddingHorizontal: Spacing.lg },
  value: { flex: 1, ...Type.body, color: Brand.text },
  placeholder: { color: Brand.textTertiary },
  dialogHost: { position: 'absolute', width: 0, height: 0 },
});
