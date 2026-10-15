import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fieldBox } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { TimeDialog } from '@/components/picker-dialog';
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

// The native time picker, like DateField's: Material dialog on Android, a sheet on iOS.
export function TimeField({ label, value, onChange, error, hint, start, variant = 'field', testID }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const dialog = open ? (
    <TimeDialog label={label} initial={value || start}
      onSelect={(next) => { onChange(next); setOpen(false); }} onDismiss={() => setOpen(false)} />
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
});
