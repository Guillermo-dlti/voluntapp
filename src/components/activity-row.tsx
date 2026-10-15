import { StyleSheet, Text, View } from 'react-native';

import { ActivityStatusBadge } from '@/components/activity-status';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import type { ActivitySummary } from '@/services/activities';
import { activityStep, listHint } from '@/utils/activity-flow';
import { formatSchedule, mexicoParts } from '@/utils/time';

const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

// Day and month the activity starts on in Guadalajara, as a small calendar tile so a list scans by
// date (after Apple Calendar). The tile stays neutral; only the month's color says green while it's
// ahead, mango when attendance waits, gray once it's over or cancelled.
function DateTile({ activity, attention }: { activity: ActivitySummary; attention: boolean }) {
  const date = mexicoParts(activity.startsAt).date;
  const month = monthFormat.format(new Date(`${date}T12:00:00Z`)).replace('.', '');
  const step = activityStep(activity);
  const over = step === 'finalized' || step === 'cancelled';
  const monthColor = attention ? styles.tileTextMango : over ? styles.tileTextMuted : styles.tileTextGreen;
  return (
    <View style={styles.tile} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.tileMonth, monthColor]}>{month}</Text>
      <Text style={[styles.tileDay, over && styles.tileTextMuted]}>{Number(date.slice(8, 10))}</Text>
    </View>
  );
}

// Two lines of detail (schedule, place), the fill level, and what the activity needs next, so a row
// answers "when, where, how full, what's missing". Used by the Actividades list and Inicio.
export function ActivityRow({ activity, onPress, testID }: { activity: ActivitySummary; onPress: () => void; testID?: string }) {
  const hint = listHint(activity);
  // At large text sizes the whole name and place show, however many lines they take.
  const largeText = useLargeText();
  return (
    <PressableScale testID={testID ?? `activity-row-${activity.id}`} accessibilityRole="button" onPress={onPress} style={styles.row}>
      <DateTile activity={activity} attention={hint?.tone === 'attention'} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={largeText ? undefined : 2}>{activity.name}</Text>
        <Text style={styles.detail}>{formatSchedule(activity.startsAt, activity.endsAt)}</Text>
        <Text style={styles.detail} numberOfLines={largeText ? undefined : 1}>{activity.location}</Text>
        <View style={styles.meta}>
          <ActivityStatusBadge status={activity.status} />
          <Text style={styles.count}>{activity.assignedCount}/{activity.capacity} asignados</Text>
        </View>
        {hint ? (
          <View style={styles.hint}>
            {hint.tone === 'attention' ? <Icon name={{ ios: 'exclamationmark.circle', android: 'pending_actions' }} size={16} color={Brand.accentText} /> : null}
            <Text testID={`activity-hint-${activity.id}`} style={[styles.hintText, hint.tone !== 'neutral' && styles.hintStrong]}>{hint.text}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chevron}><Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={Brand.textTertiary} /></View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  tile: { minWidth: 48, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 7, borderRadius: Radius.tile, alignItems: 'center', marginTop: 2, backgroundColor: Brand.surfaceMuted },
  tileMonth: { fontFamily: AppFonts.bodySemiBold, fontSize: 12, lineHeight: 15 },
  tileDay: { fontFamily: AppFonts.headingSemiBold, fontSize: 21, lineHeight: 25, color: Brand.text, fontVariant: ['tabular-nums'] },
  tileTextGreen: { color: Brand.primary },
  tileTextMango: { color: Brand.accentText },
  tileTextMuted: { color: Brand.textSecondary },
  rowText: { flex: 1, gap: 4 },
  name: { fontFamily: AppFonts.bodySemiBold, fontSize: 16, color: Brand.text },
  detail: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  count: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textSecondary },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  hintText: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textSecondary },
  chevron: { alignSelf: 'center' },
  hintStrong: { fontFamily: AppFonts.bodySemiBold, color: Brand.accentText },
});
