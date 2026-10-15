import { StyleSheet, Text, View } from 'react-native';

import { ActivityStepBadge } from '@/components/activity-status';
import { RowMetrics } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import type { ActivitySummary } from '@/services/activities';
import { activityStep, listHint } from '@/utils/activity-flow';
import { formatTimeRange, mexicoParts } from '@/utils/time';

const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

// Day and month the activity starts on in Guadalajara, as a small calendar tile so a list scans by
// date (after Apple Calendar). The tile stays neutral; only the month's color says green while it's
// ahead, mango when attendance waits, gray once it's over or cancelled.
function DateTile({ activity }: { activity: ActivitySummary }) {
  const date = mexicoParts(activity.startsAt).date;
  const month = monthFormat.format(new Date(`${date}T12:00:00Z`)).replace('.', '');
  const step = activityStep(activity);
  const over = step === 'finalized' || step === 'cancelled';
  const monthColor = step === 'attendance' ? styles.tileTextMango : over ? styles.tileTextMuted : styles.tileTextGreen;
  return (
    <View style={styles.tile} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.tileMonth, monthColor]}>{month}</Text>
      <Text style={[styles.tileDay, over && styles.tileTextMuted]}>{Number(date.slice(8, 10))}</Text>
    </View>
  );
}

// After Peloton's and Jira's schedule rows: the name; the hours (the tile already has the day); the
// place; the step pill with the one fact that matters next (how full it is). Used by the Actividades
// list and Inicio.
export function ActivityRow({ activity, onPress, testID }: { activity: ActivitySummary; onPress: () => void; testID?: string }) {
  const hint = listHint(activity);
  // At large text sizes the whole name and place show, however many lines they take.
  const largeText = useLargeText();
  return (
    <PressableScale testID={testID ?? `activity-row-${activity.id}`} accessibilityRole="button" onPress={onPress}
      android_ripple={{ color: Brand.surfaceMuted }} style={styles.row}>
      <DateTile activity={activity} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={largeText ? undefined : 2}>{activity.name}</Text>
        <Text style={styles.detail}>{formatTimeRange(activity.startsAt, activity.endsAt)}</Text>
        <Text style={styles.detail} numberOfLines={largeText ? undefined : 1}>{activity.location}</Text>
        <View style={styles.meta}>
          <ActivityStepBadge activity={activity} />
          {hint ? (
            <Text testID={`activity-hint-${activity.id}`} style={[styles.hint, hint.tone === 'full' && styles.hintStrong]}>{hint.text}</Text>
          ) : null}
        </View>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={Brand.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The chevron sits on the row's middle; the tile lines up with the name, like a calendar.
  row: { flexDirection: 'row', alignItems: 'center', gap: RowMetrics.gap, paddingVertical: 14, paddingHorizontal: RowMetrics.padding },
  tile: {
    minWidth: RowMetrics.tile, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 7, borderRadius: Radius.tile,
    alignItems: 'center', backgroundColor: Brand.surfaceMuted, alignSelf: 'flex-start',
  },
  tileMonth: { ...Type.caption, lineHeight: 15 },
  tileDay: { fontFamily: Type.headline.fontFamily, fontSize: 21, lineHeight: 25, color: Brand.text, fontVariant: ['tabular-nums'] },
  tileTextGreen: { color: Brand.primary },
  tileTextMango: { color: Brand.accentText },
  tileTextMuted: { color: Brand.textSecondary },
  rowText: { flex: 1, gap: 2 },
  name: { ...Type.bodyStrong, color: Brand.text },
  detail: { ...Type.callout, color: Brand.textSecondary },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: Spacing.xs, marginTop: 6 },
  hint: { ...Type.footnote, color: Brand.textSecondary },
  hintStrong: { fontFamily: Type.calloutStrong.fontFamily, color: Brand.text },
});
