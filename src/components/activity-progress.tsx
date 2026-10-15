import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { flowSteps, type ActivityStep, type NextStep } from '@/utils/activity-flow';

// Borrador → Publicada → Asistencia → Finalizada, with the steps behind checked and the current one ringed.
export function ProgressStrip({ step }: { step: Exclude<ActivityStep, 'cancelled'> }) {
  const current = flowSteps.findIndex((entry) => entry.step === step);
  return (
    <View testID="activity-progress" accessible accessibilityLabel={`Paso ${current + 1} de ${flowSteps.length}: ${flowSteps[current].label}`}
      style={styles.strip}>
      {flowSteps.map((entry, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={entry.step} style={styles.step}>
            <View style={styles.track}>
              <View style={[styles.line, index === 0 && styles.hidden, (done || active) && styles.lineDone]} />
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                {done ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={14} color={Brand.surface} />
                  : active ? <View style={styles.core} /> : null}
              </View>
              <View style={[styles.line, index === flowSteps.length - 1 && styles.hidden, done && styles.lineDone]} />
            </View>
            <Text style={[styles.label, (done || active) && styles.labelReached, active && styles.labelActive]} numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
              {entry.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface NextStepCardProps {
  step: ActivityStep;
  next: NextStep;
  busy?: boolean;
  busyLabel?: string;
  onAction: () => void;
}

// The one thing to do now, in words, with its button when the role may do it.
export function NextStepCard({ step, next, busy = false, busyLabel, onAction }: NextStepCardProps) {
  const tone = step === 'cancelled' ? 'critical' : step === 'attendance' ? 'attention' : step === 'finalized' ? 'done' : 'next';
  const icon: Parameters<typeof Icon>[0]['name'] = tone === 'critical' ? { ios: 'xmark.circle', android: 'event_busy' }
    : tone === 'attention' ? { ios: 'checklist', android: 'fact_check' }
      : tone === 'done' ? { ios: 'checkmark.seal', android: 'verified' }
        : { ios: 'arrow.right.circle', android: 'arrow_circle_right' };
  return (
    <Card testID="activity-next-step">
      <View style={styles.card}>
        <View style={styles.message}>
          <View style={[styles.iconWell, styles[tone]]}>
            <Icon name={icon} size={20} color={tone === 'critical' ? Brand.danger : tone === 'attention' ? Brand.accentText : Brand.primary} />
          </View>
          <Text testID="activity-next-step-text" accessibilityLiveRegion="polite" style={styles.text}>{next.text}</Text>
        </View>
        {next.action ? (
          <Button testID={`activity-next-${next.action.kind}`} label={next.action.label} busy={busy} busyLabel={busyLabel}
            onPress={onAction} />
        ) : null}
      </View>
    </Card>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  strip: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2, backgroundColor: Brand.border },
  lineDone: { backgroundColor: Brand.primary },
  hidden: { backgroundColor: 'transparent' },
  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, borderColor: Brand.border,
    backgroundColor: Brand.surface, alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  dotActive: { borderColor: Brand.primary },
  core: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  // Four labels share one row, so they grow only to 1.3× with the system text size; the strip's
  // accessibility label still reads the full step aloud.
  label: { alignSelf: 'stretch', textAlign: 'center', fontFamily: AppFonts.body, fontSize: 12, color: Brand.textTertiary },
  labelReached: { color: Brand.textSecondary },
  labelActive: { fontFamily: AppFonts.bodySemiBold, color: Brand.text },
  card: { gap: 14 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: { width: 40, height: 40, borderRadius: Radius.tile, alignItems: 'center', justifyContent: 'center' },
  next: { backgroundColor: Brand.primaryLight },
  done: { backgroundColor: Brand.primaryLight },
  attention: { backgroundColor: Brand.accentLight },
  critical: { backgroundColor: Brand.dangerLight },
  text: { flex: 1, fontFamily: AppFonts.body, fontSize: 16, lineHeight: 22, color: Brand.text },
});
