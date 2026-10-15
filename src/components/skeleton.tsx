import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Card } from '@/components/card';
import { Section } from '@/components/grouped-list';
import { Brand, Motion, Radius } from '@/constants/theme';
import { useLargeText } from '@/hooks/use-large-text';
import { useMotion } from '@/utils/motion';

// The light band that sweeps across a placeholder. Built from a few strips of rising and falling
// white instead of a gradient, because react-native-web drops React Native's gradient style.
const BAND = 140;
const strips = [0.12, 0.28, 0.45, 0.28, 0.12] as const;

function Shimmer() {
  const { reduced } = useMotion();
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);
  useEffect(() => {
    // Reduce Motion: the same light pulses in place (yoyo) instead of travelling across.
    progress.set(withRepeat(withTiming(1, { duration: Motion.shimmer, easing: Easing.inOut(Easing.quad) }), -1, reduced));
    return () => cancelAnimation(progress);
  }, [progress, reduced]);
  const animated = useAnimatedStyle(() => (reduced
    ? { opacity: progress.get() * 0.7 }
    : { transform: [{ translateX: -BAND + progress.get() * (width + BAND) }] }));
  if (reduced) return <Animated.View style={[StyleSheet.absoluteFill, styles.pulse, animated]} />;
  return (
    <Animated.View style={[styles.band, animated]}>
      {strips.map((opacity, index) => <View key={index} style={[styles.strip, { opacity }]} />)}
    </Animated.View>
  );
}

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// One placeholder block. Lists and cards compose these into the shape of what will load, so the
// screen doesn't jump when the data arrives.
export function Skeleton({ width = '100%', height, radius = 6, style }: SkeletonProps) {
  return (
    <View style={[styles.block, { width, height, borderRadius: radius }, style]}>
      <Shimmer />
    </View>
  );
}

// A line of text at `size` points, grown with the system font size the way the real text will be.
export function SkeletonLine({ size, width }: { size: number; width: DimensionValue }) {
  const { fontScale } = useWindowDimensions();
  const height = Math.round(size * fontScale);
  return <Skeleton width={width} height={height} radius={height / 3} style={{ marginVertical: Math.round(height * 0.15) }} />;
}

// Wraps a placeholder so a screen reader hears one "Cargando…" instead of a run of empty shapes.
function Loading({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={style}>{children}</View>
    </View>
  );
}

// ActivityRow: date tile, name, schedule, place, status pill and count.
function ActivityRowShape() {
  return (
    <View style={styles.activityRow}>
      <Skeleton width={48} height={58} radius={Radius.tile} />
      <View style={styles.rowText}>
        <SkeletonLine size={16} width="72%" />
        <SkeletonLine size={14} width="58%" />
        <SkeletonLine size={14} width="44%" />
        <View style={styles.meta}>
          <Skeleton width={84} height={24} radius={Radius.pill} />
          <SkeletonLine size={13} width={80} />
        </View>
      </View>
    </View>
  );
}

// Row with an Avatar (volunteers) or an icon well (detail rows), a label and a value.
export function SkeletonRow({ leading }: { leading: 'avatar' | 'icon' }) {
  return (
    <View style={styles.row}>
      {leading === 'avatar' ? <Skeleton width={40} height={40} radius={20} /> : <Skeleton width={34} height={34} radius={Radius.well} />}
      <View style={styles.rowText}>
        <SkeletonLine size={16} width="52%" />
        <SkeletonLine size={14} width="34%" />
      </View>
    </View>
  );
}

function SectionTitleShape() {
  return <View style={styles.sectionTitle}><SkeletonLine size={14} width={140} /></View>;
}

type ListVariant = 'activity' | 'person' | 'detail';

export function SkeletonList({ variant, rows = 4, title = false, label = 'Cargando…' }: { variant: ListVariant; rows?: number; title?: boolean; label?: string }) {
  return (
    <Loading label={label} style={styles.stack}>
      {title ? <SectionTitleShape /> : null}
      <Section>
        {Array.from({ length: rows }, (_, index) => (variant === 'activity'
          ? <ActivityRowShape key={index} />
          : <SkeletonRow key={index} leading={variant === 'person' ? 'avatar' : 'icon'} />))}
      </Section>
    </Loading>
  );
}

// StatCard: icon and label, the big number, a caption.
function StatShape({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[styles.stat, style]}>
      <View style={styles.statTop}>
        <Skeleton width={16} height={16} radius={8} />
        <SkeletonLine size={14} width="55%" />
      </View>
      <SkeletonLine size={34} width="42%" />
      <SkeletonLine size={13} width="64%" />
    </Card>
  );
}

// 'hero': one wide card over a pair (the admin dashboard). 'pair': two side by side.
export function SkeletonStats({ layout }: { layout: 'hero' | 'pair' }) {
  const largeText = useLargeText();
  return (
    <View style={styles.stats}>
      {layout === 'hero' ? <StatShape /> : null}
      <View style={[styles.pair, largeText && styles.stacked]}><StatShape style={styles.half} /><StatShape style={styles.half} /></View>
    </View>
  );
}

export function SkeletonDashboard({ layout }: { layout: 'hero' | 'pair' }) {
  return (
    <Loading label="Cargando el inicio…" style={styles.screen}>
      <SkeletonStats layout={layout} />
      <View style={styles.stack}>
        <SectionTitleShape />
        <Section><ActivityRowShape /><ActivityRowShape /></Section>
      </View>
    </Loading>
  );
}

// Activity detail: progress strip, next step card, tabs, then the details section.
export function SkeletonActivityDetail() {
  return (
    <Loading label="Cargando la actividad…" style={styles.screen}>
      <View style={styles.progress}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.progressStep}>
            <Skeleton width={24} height={24} radius={12} />
            <SkeletonLine size={12} width="70%" />
          </View>
        ))}
      </View>
      <Card>
        <View style={styles.nextStep}>
          <View style={styles.nextMessage}>
            <Skeleton width={40} height={40} radius={Radius.tile} />
            <View style={styles.rowText}><SkeletonLine size={15} width="90%" /><SkeletonLine size={15} width="60%" /></View>
          </View>
          <Skeleton height={54} radius={Radius.button} />
        </View>
      </Card>
      <Skeleton height={54} radius={Radius.button} />
      <Section><SkeletonRow leading="icon" /><SkeletonRow leading="icon" /><SkeletonRow leading="icon" /></Section>
    </Loading>
  );
}

// Volunteer detail: hours and activities, then contact rows.
export function SkeletonVolunteerDetail() {
  return (
    <Loading label="Cargando el registro…" style={styles.screen}>
      <SkeletonStats layout="pair" />
      <View style={styles.stack}>
        <SectionTitleShape />
        <Section><SkeletonRow leading="icon" /><SkeletonRow leading="icon" /><SkeletonRow leading="icon" /></Section>
      </View>
      <View style={styles.stack}>
        <SectionTitleShape />
        <Section><SkeletonRow leading="icon" /></Section>
      </View>
    </Loading>
  );
}

// A form waiting for the record it edits: label and field, a few times over.
export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <Loading label="Cargando el formulario…" style={styles.form}>
      {Array.from({ length: fields }, (_, index) => (
        <View key={index} style={styles.field}>
          <SkeletonLine size={14} width={120} />
          <Skeleton height={54} radius={Radius.input} />
        </View>
      ))}
    </Loading>
  );
}

// Reportes summary: a line of totals, then a card of horizontal bars.
export function SkeletonReport() {
  return (
    <Loading label="Calculando el reporte…" style={styles.screen}>
      <SkeletonLine size={15} width="80%" />
      <View style={styles.stack}>
        <SectionTitleShape />
        <Card>
          <View style={styles.bars}>
            {['86%', '70%', '55%', '40%', '28%'].map((width) => (
              <View key={width} style={styles.barRow}>
                <SkeletonLine size={14} width="45%" />
                <Skeleton width={width as DimensionValue} height={8} radius={4} />
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Loading>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: Brand.surfaceMuted, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BAND, flexDirection: 'row' },
  strip: { flex: 1, backgroundColor: Brand.surface },
  pulse: { backgroundColor: Brand.surface },
  // Same gaps as Screen content and Section, so the placeholder sits where the content will.
  screen: { gap: 28 },
  stack: { gap: 8 },
  sectionTitle: { paddingHorizontal: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  stats: { gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  stacked: { flexDirection: 'column' },
  half: { flex: 1 },
  stat: { gap: 4 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  progress: { flexDirection: 'row' },
  progressStep: { flex: 1, alignItems: 'center', gap: 6 },
  nextStep: { gap: 16 },
  nextMessage: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  form: { gap: 24 },
  field: { gap: 8 },
  bars: { gap: 14 },
  barRow: { gap: 6 },
});
