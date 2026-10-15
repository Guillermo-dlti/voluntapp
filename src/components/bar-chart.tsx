import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';

import { badgeColors, type BadgeTone } from '@/components/status-badge';
import { AppFonts, Brand } from '@/constants/theme';

// Plain views with percent widths: two simple charts don't justify a chart library and a native module.

const MIN_BAR = 4;

export interface BarItem {
  key: string;
  label: string;
  value: number;
  // The value in words, shown at the end of the row ("12 horas").
  valueLabel: string;
  onPress?: () => void;
  testID?: string;
}

// One horizontal bar per item, scaled to the largest value. Items come already sorted.
export function HorizontalBars({ items, testID }: { items: BarItem[]; testID?: string }) {
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <View testID={testID} style={styles.bars}>
      {items.map((item) => {
        const content = (
          <>
            <View style={styles.barHead}>
              <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.barValue}>{item.valueLabel}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: max > 0 ? `${(item.value / max) * 100}%` : 0 }]} />
            </View>
          </>
        );
        return item.onPress ? (
          <PressableScale key={item.key} testID={item.testID} accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.valueLabel}`} onPress={item.onPress}
            android_ripple={{ color: Brand.surfaceMuted }} style={styles.barRow}>
            {content}
          </PressableScale>
        ) : <View key={item.key} testID={item.testID} style={styles.barRow}>{content}</View>;
      })}
    </View>
  );
}

export interface StackSegment {
  key: string;
  label: string;
  count: number;
  tone: BadgeTone;
}

const percent = (count: number, total: number) => `${Math.round((count / total) * 100)} %`;

// One bar split into segments, with a legend that always names each one in words.
// Callers handle a total of 0 (there is nothing to split).
export function StackedBar({ segments, testID }: { segments: StackSegment[]; testID?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const legend = segments.map((segment) => `${segment.label} ${segment.count} · ${percent(segment.count, total)}`);
  return (
    <View testID={testID} style={styles.stack}>
      <View accessible accessibilityLabel={legend.join(', ')} style={styles.stackTrack}>
        {segments.filter((segment) => segment.count > 0).map((segment, index) => (
          <View key={segment.key} style={[{ width: `${(segment.count / total) * 100}%`, backgroundColor: badgeColors[segment.tone].dot },
            index > 0 && styles.divider]} />
        ))}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        {segments.map((segment, index) => (
          <View key={segment.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: badgeColors[segment.tone].dot }]} />
            <Text style={styles.legendText}>{legend[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { gap: 2 },
  barRow: { minHeight: 48, justifyContent: 'center', gap: 6, paddingVertical: 6, borderRadius: 8 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  barLabel: { flex: 1, fontFamily: AppFonts.body, fontSize: 15, color: Brand.text },
  barValue: { fontFamily: AppFonts.headingSemiBold, fontSize: 15, color: Brand.text },
  track: { height: 6, borderRadius: 3, backgroundColor: Brand.surfaceMuted, overflow: 'hidden' },
  fill: { height: 6, minWidth: MIN_BAR, borderRadius: 3, backgroundColor: Brand.primary },
  stack: { gap: 12 },
  stackTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: Brand.surfaceMuted },
  // A thin line of the card color between segments, inside the width so the bar still adds up to 100 %.
  divider: { borderLeftWidth: 2, borderLeftColor: Brand.surface },
  legend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary },
});
