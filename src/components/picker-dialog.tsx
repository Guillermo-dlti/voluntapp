import { DatePickerDialog, Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';

export interface DateDialogProps {
  // Shown on iOS as the sheet's title.
  label: string;
  // YYYY-MM-DD the calendar opens on.
  initial: string;
  // Inclusive range, as YYYY-MM-DD.
  min: string;
  max: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}

export interface TimeDialogProps {
  label: string;
  // HH:MM the picker opens on.
  initial: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

// Android: the native Material dialogs. iOS has its own file (`picker-dialog.ios.tsx`), since
// Jetpack Compose views don't exist there.
//
// Dates are whole days, so the picker's midnight-UTC value is cut to its date part. A dialog (instead
// of an inline picker) keeps the form from jumping while it scrolls, and only reports on confirm.
export function DateDialog({ initial, min, max, onSelect, onDismiss }: DateDialogProps) {
  return (
    <Host style={styles.host}>
      <DatePickerDialog
        variant="picker"
        initialDate={`${initial}T00:00:00.000Z`}
        selectableDates={{ start: new Date(`${min}T00:00:00Z`), end: new Date(`${max}T00:00:00Z`) }}
        color={Brand.primary}
        confirmButtonLabel="Usar fecha"
        dismissButtonLabel="Cancelar"
        onDateSelected={(date) => { onSelect(date.toISOString().slice(0, 10)); }}
        onDismissRequest={onDismiss}
      />
    </Host>
  );
}

// The native time picker reads and reports hours in the phone's own zone, so both directions go
// through a local Date; only the hour and minute matter.
export function TimeDialog({ initial, onSelect, onDismiss }: TimeDialogProps) {
  const [hour, minute] = initial.split(':').map(Number);
  return (
    <Host style={styles.host}>
      <TimePickerDialog
        is24Hour={false}
        initialDate={new Date(2000, 0, 1, hour, minute).toISOString()}
        color={Brand.primary}
        confirmButtonLabel="Usar hora"
        dismissButtonLabel="Cancelar"
        onDateSelected={(date) => { onSelect(`${pad(date.getHours())}:${pad(date.getMinutes())}`); }}
        onDismissRequest={onDismiss}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 0, height: 0 },
});
