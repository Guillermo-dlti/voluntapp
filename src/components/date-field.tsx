import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Radius } from '@/constants/theme';
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
  testID?: string;
}

// A field that opens the native Material date picker dialog. Dates are whole days, so they travel
// as YYYY-MM-DD and the picker's midnight-UTC value is cut to its date part. A dialog (instead of
// an inline picker) keeps the form from jumping while it scrolls, and only reports on "Usar fecha".
export function DateField({ label, value, onChange, error, hint, min, max, start, testID }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : 'sin fecha'}`}
        accessibilityHint={error ?? hint} onPress={() => setOpen(true)}
        style={[styles.input, open && styles.focused, error ? styles.invalid : undefined]}>
        <Icon name={{ ios: 'calendar', android: 'calendar_month' }} size={20} color={Brand.textSecondary} />
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDate(value) : 'Sin fecha'}</Text>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar fecha" hitSlop={10} onPress={() => { onChange(''); setOpen(false); }}>
            <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={20} color={Brand.textTertiary} />
          </Pressable>
        ) : null}
      </PressableScale>
      {open ? (
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
