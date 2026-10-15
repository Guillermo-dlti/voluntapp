import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fieldBox } from '@/components/form-field';
import { Icon } from '@/components/icon';
import { PickerRow } from '@/components/picker-row';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Spacing, Type } from '@/constants/theme';
import { formatDate } from '@/utils/time';

interface DateFieldProps {
  label: string;
  // YYYY-MM-DD, or '' for no date.
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  // Inclusive range the picker allows, as YYYY-MM-DD.
  min: string;
  max: string;
  // Where the calendar opens when there is no value yet (for a birth date, some decades back).
  start: string;
  // 'row' inside a grouped card (the activity schedule); 'field' is a labeled box like FormField.
  variant?: 'field' | 'row';
  testID?: string;
}

// A field that opens the native Material date picker dialog. Dates are whole days, so they travel
// as YYYY-MM-DD and the picker's midnight-UTC value is cut to its date part. A dialog (instead of
// an inline picker) keeps the form from jumping while it scrolls, and only reports on "Usar fecha".
export function DateField({ label, value, onChange, error, hint, min, max, start, variant = 'field', testID }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const dialog = open ? (
    <Host style={styles.dialogHost}>
      <DatePickerDialog
        variant="picker"
        initialDate={`${value || start}T00:00:00.000Z`}
        selectableDates={{ start: new Date(`${min}T00:00:00Z`), end: new Date(`${max}T00:00:00Z`) }}
        color={Brand.primary}
        confirmButtonLabel="Usar fecha"
        dismissButtonLabel="Cancelar"
        onDateSelected={(date) => { onChange(date.toISOString().slice(0, 10)); setOpen(false); }}
        onDismissRequest={() => setOpen(false)}
      />
    </Host>
  ) : null;

  if (variant === 'row') {
    return (
      <>
        <PickerRow testID={testID} label={label} value={value ? formatDate(value) : ''} placeholder="Elegir fecha"
          open={open} error={error} onPress={() => setOpen(true)} />
        {dialog}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : 'sin fecha'}`}
        accessibilityHint={error ?? hint} onPress={() => setOpen(true)}
        style={[styles.box, styles.inside, open && styles.focused, error ? styles.invalid : undefined]}>
        <Icon name={{ ios: 'calendar', android: 'calendar_month' }} size={20} color={Brand.textSecondary} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDate(value) : 'Sin fecha'}</Text>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar fecha" hitSlop={10} onPress={() => { onChange(''); setOpen(false); }}>
            <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={20} color={Brand.textTertiary} />
          </Pressable>
        ) : null}
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
