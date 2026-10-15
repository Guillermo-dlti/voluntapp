import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { RowMetrics } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { useLargeText } from '@/hooks/use-large-text';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import type { AttendanceStatus, Participant } from '@/services/activities';
import { attendanceStatusLabels, hoursText } from '@/utils/attendance-rules';

export const attendanceTones: Record<AttendanceStatus, BadgeTone> = { present: 'success', late: 'attention', absent: 'critical' };

// The roll call buttons say "Falta" (what staff call out); the saved badge keeps "Ausente".
const choices: readonly { status: AttendanceStatus; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { status: 'present', label: 'Presente', icon: { ios: 'checkmark', android: 'check' } },
  { status: 'late', label: 'Tarde', icon: { ios: 'clock', android: 'schedule' } },
  { status: 'absent', label: 'Falta', icon: { ios: 'xmark', android: 'close' } },
];

interface RollCallRowProps {
  entry: Participant;
  // Show the Presente / Tarde / Falta buttons (attendance open and the role may record).
  recording: boolean;
  // Saving this row: its buttons wait, the other rows stay usable.
  busy: boolean;
  // Another action (mark all, finalize) is running.
  locked: boolean;
  error?: string;
  onChoose: (status: AttendanceStatus) => void;
  // Opens the full form (times, custom hours, or an admin correction). Absent when the row is read only.
  onOpen?: () => void;
}

export function RollCallRow({ entry, recording, busy, locked, error, onChoose, onOpen }: RollCallRowProps) {
  const name = `${entry.firstName} ${entry.lastName}`;
  const record = entry.attendance;
  const largeText = useLargeText();
  const summary = (
    <>
      <Avatar name={name} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={largeText ? undefined : 1}>{name}</Text>
        <Text style={styles.detail}>
          {record ? `${hoursText(record.hours)} h${record.correctionReason ? ' · corregido' : ''}` : 'Sin registrar'}
        </Text>
      </View>
      {/* While recording, the selected button already says the status; the pill is for read-only rows. */}
      {busy ? <ActivityIndicator color={Brand.primary} accessibilityLabel="Guardando" />
        : record && !recording ? <StatusBadge label={attendanceStatusLabels[record.status]} tone={attendanceTones[record.status]} /> : null}
      {onOpen ? <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={Brand.textTertiary} /> : null}
    </>
  );
  return (
    <View testID={`attendance-${entry.volunteerId}`} style={styles.row}>
      {onOpen ? (
        <PressableScale testID={`attendance-${entry.volunteerId}-open`} accessibilityRole="button"
          accessibilityLabel={`${name}. ${record ? attendanceStatusLabels[record.status] : 'Sin registrar'}. Abrir registro completo`}
          android_ripple={{ color: Brand.surfaceMuted }} onPress={onOpen} style={styles.summary}>
          {summary}
        </PressableScale>
      ) : <View style={styles.summary}>{summary}</View>}

      {recording ? (
        <View style={styles.choices}>
          {choices.map((choice, index) => {
            const selected = record?.status === choice.status;
            return (
              <PressableScale key={choice.status} testID={`attendance-${entry.volunteerId}-${choice.status}`}
                accessibilityRole="button" accessibilityLabel={`${choice.label}: ${name}`}
                accessibilityState={{ selected, disabled: busy || locked, busy }} disabled={busy || locked}
                onPress={() => onChoose(choice.status)}
                style={[styles.choice, index > 0 && styles.divided, selected && styles[choice.status], (busy || locked) && styles.waiting]}>
                <Icon name={choice.icon} size={16} color={selected ? Brand.surface : Brand.textSecondary} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.choiceLabel, selected && styles.choiceSelected]}>{choice.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingBottom: Spacing.xs },
  summary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: RowMetrics.gap, paddingHorizontal: RowMetrics.padding, paddingVertical: Spacing.sm },
  text: { flex: 1, gap: 2 },
  name: { ...Type.body, color: Brand.text },
  detail: { ...Type.callout, color: Brand.textSecondary },
  // One joined control rather than three loose buttons (after iOS segmented controls): it reads as a
  // single choice and weighs less on a long roll. Each segment keeps the 48 dp touch target.
  choices: {
    flexDirection: 'row', marginHorizontal: RowMetrics.padding, marginBottom: Spacing.md,
    borderRadius: Radius.button, borderWidth: 1, borderColor: Brand.border, overflow: 'hidden',
  },
  choice: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Brand.surface,
  },
  divided: { borderLeftWidth: 1, borderLeftColor: Brand.border },
  present: { backgroundColor: Brand.success, borderLeftColor: Brand.success },
  late: { backgroundColor: Brand.accentText, borderLeftColor: Brand.accentText },
  absent: { backgroundColor: Brand.danger, borderLeftColor: Brand.danger },
  waiting: { opacity: 0.5 },
  choiceLabel: { ...Type.calloutStrong, color: Brand.text },
  choiceSelected: { color: Brand.surface },
  error: { ...Type.footnote, color: Brand.dangerText, paddingHorizontal: RowMetrics.padding, paddingBottom: Spacing.md },
});
