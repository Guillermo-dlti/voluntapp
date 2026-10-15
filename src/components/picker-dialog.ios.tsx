import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import type { DateDialogProps, TimeDialogProps } from '@/components/picker-dialog';
import { Brand, Elevation, Radius, Spacing, Type } from '@/constants/theme';
import { useMotion } from '@/utils/motion';

const pad = (value: number) => String(value).padStart(2, '0');
// Days travel as YYYY-MM-DD; on the phone they sit at local noon so no time zone shift moves the day.
const toLocalDay = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
};
const fromLocalDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// A bottom sheet around the iOS picker, with the same confirm and cancel as Android's dialog: the
// value only reaches the form on "Usar fecha"/"Usar hora".
function PickerSheet({ title, confirmLabel, onConfirm, onDismiss, children }: {
  title: string; confirmLabel: string; onConfirm: () => void; onDismiss: () => void; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View entering={motion.sheetIn()} style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <View style={styles.picker}>{children}</View>
          <View style={styles.actions}>
            <View style={styles.action}><Button label="Cancelar" variant="secondary" onPress={onDismiss} /></View>
            <View style={styles.action}><Button label={confirmLabel} onPress={onConfirm} /></View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function DateDialog({ label, initial, min, max, onSelect, onDismiss }: DateDialogProps) {
  const [draft, setDraft] = useState(() => toLocalDay(initial));
  return (
    <PickerSheet title={label} confirmLabel="Usar fecha" onConfirm={() => { onSelect(fromLocalDay(draft)); }} onDismiss={onDismiss}>
      <DateTimePicker value={draft} mode="date" display="inline" locale="es-MX" themeVariant="light" accentColor={Brand.primary}
        minimumDate={toLocalDay(min)} maximumDate={toLocalDay(max)} style={styles.calendar} onChange={(_, date) => { if (date) setDraft(date); }} />
    </PickerSheet>
  );
}

export function TimeDialog({ label, initial, onSelect, onDismiss }: TimeDialogProps) {
  const [draft, setDraft] = useState(() => {
    const [hour, minute] = initial.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute);
  });
  return (
    <PickerSheet title={label} confirmLabel="Usar hora" onConfirm={() => { onSelect(`${pad(draft.getHours())}:${pad(draft.getMinutes())}`); }} onDismiss={onDismiss}>
      <DateTimePicker value={draft} mode="time" display="spinner" locale="es-MX" themeVariant="light" textColor={Brand.text}
        style={styles.wheel} onChange={(_, date) => { if (date) setDraft(date); }} />
    </PickerSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Brand.scrim },
  sheet: {
    gap: Spacing.lg, paddingTop: 10, paddingHorizontal: Spacing.gutter,
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, backgroundColor: Brand.surface, boxShadow: Elevation.raised,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Brand.border },
  title: { ...Type.headline, color: Brand.text, paddingHorizontal: Spacing.xs },
  // iOS doesn't report the native pickers' height to the layout, so without one the sheet is laid out
  // too short and the picker spills over its buttons. These are the system sizes for each style.
  picker: { alignSelf: 'stretch' },
  wheel: { alignSelf: 'stretch', height: 216 },
  calendar: { alignSelf: 'stretch', height: 360 },
  actions: { flexDirection: 'row', gap: Spacing.md },
  action: { flex: 1 },
});
