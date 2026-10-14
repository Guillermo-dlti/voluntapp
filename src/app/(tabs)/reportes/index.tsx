import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { FilterChips } from '@/components/filter-chips';
import { Row, Section } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  getSummary, listActivityAttendance, listVolunteerHours,
  type ActivityAttendanceRow, type ReportPage, type ReportSummary, type VolunteerHoursRow,
} from '@/services/reports';
import {
  formatHours, plural, presetRange, rangeErrors, rangeLabel, shortDay, type RangePreset, type ReportRange,
} from '@/utils/report-range';
import { todayInMexico } from '@/utils/time';

const PREVIEW_ROWS = 5;
// Custom dates the pickers offer: BAMX's records start long after 2000, and activities are planned at most a year ahead.
const EARLIEST_DAY = '2000-01-01';

const presetOptions = [
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes pasado' },
  { value: 'thisYear', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
] as const;

interface ReportData {
  summary: ReportSummary;
  volunteers: ReportPage<VolunteerHoursRow>;
  activities: ReportPage<ActivityAttendanceRow>;
}

const number = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);

export default function ReportsScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [custom, setCustom] = useState<ReportRange>(() => presetRange('thisMonth'));
  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset)), [preset, custom]);
  const errors = rangeErrors(range);
  const valid = !errors.from && !errors.to;
  const latestDay = `${Number(todayInMexico().slice(0, 4)) + 1}-12-31`;
  const [data, setData] = useState<ReportData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest range may fill the screen, so a slow earlier request can't overwrite it.
  const latest = useRef(0);
  // The range whose numbers are on screen; a different one shows the spinner, a refresh of the same one doesn't.
  const shown = useRef('');

  const load = useCallback(async () => {
    const request = ++latest.current;
    if (!valid) { setRefreshing(false); return; }
    const period = { from: range.from, to: range.to };
    const key = `${period.from}_${period.to}`;
    if (shown.current !== key) setState('loading');
    try {
      const [summary, volunteers, activities] = await Promise.all([
        getSummary(period), listVolunteerHours(period, 0, PREVIEW_ROWS), listActivityAttendance(period, 0, PREVIEW_ROWS),
      ]);
      if (request !== latest.current) return;
      setData({ summary, volunteers, activities });
      shown.current = key;
      setState('ready');
    } catch (cause: unknown) {
      if (request !== latest.current) return;
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
      setState('error');
    } finally {
      if (request === latest.current) setRefreshing(false);
    }
  }, [range.from, range.to, valid, refresh]);

  // Reloads when the tab regains focus too, so attendance finalized meanwhile shows up.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const choosePreset = (next: RangePreset) => {
    // Custom starts from the period on screen, so staff only adjust what they need.
    if (next === 'custom') setCustom(range);
    setPreset(next);
  };
  const openList = (screen: '/reportes/voluntarios' | '/reportes/actividades') =>
    router.push({ pathname: screen, params: { from: range.from, to: range.to } });

  return (
    <Screen
      testID="reports-screen"
      title="Reportes"
      subtitle={valid ? rangeLabel(range) : 'Elige un periodo válido'}
      band={<FilterChips testID="reports-range" options={presetOptions} value={preset} onDark onChange={choosePreset} />}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load(); }}>
      {preset === 'custom' ? (
        <Card>
          <View style={styles.fields}>
            <DateField testID="reports-from" label="Desde" value={custom.from} error={errors.from}
              min={EARLIEST_DAY} max={latestDay} start={custom.to || todayInMexico()}
              onChange={(from) => { setCustom((current) => ({ ...current, from })); }} />
            <DateField testID="reports-to" label="Hasta" value={custom.to} error={errors.to}
              min={EARLIEST_DAY} max={latestDay} start={custom.from || todayInMexico()}
              hint="El periodo puede abarcar hasta un año."
              onChange={(to) => { setCustom((current) => ({ ...current, to })); }} />
          </View>
        </Card>
      ) : null}

      {!valid ? null : state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar el reporte" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(); }} />
        </View>
      ) : state === 'loading' || !data ? (
        <Card><View style={styles.loading}><ActivityIndicator color={Brand.primary} /><Text style={styles.muted}>Calculando el reporte…</Text></View></Card>
      ) : (
        <>
          {data.summary.pendingActivities > 0 ? (
            <View testID="reports-pending" style={styles.pending}>
              <Icon name={{ ios: 'exclamationmark.circle', android: 'pending_actions' }} size={20} color={Brand.accentText} />
              <Text style={styles.pendingText}>
                {data.summary.pendingActivities === 1
                  ? '1 actividad del periodo aún no tiene la asistencia finalizada, así que todavía no se cuenta.'
                  : `${data.summary.pendingActivities} actividades del periodo aún no tienen la asistencia finalizada, así que todavía no se cuentan.`}
              </Text>
            </View>
          ) : null}

          {data.summary.activitiesHeld === 0 ? (
            <EmptyState testID="reports-empty" icon={{ ios: 'chart.bar', android: 'bar_chart' }}
              title="No hay actividades finalizadas en este periodo"
              body="Los reportes solo cuentan asistencia finalizada. Cuando se finalice la asistencia de una actividad de este periodo, sus horas aparecerán aquí." />
          ) : (
            <>
              <View style={styles.stats}>
                <StatCard testID="reports-hours" label="Horas de voluntariado" value={number(data.summary.totalHours)}
                  caption="de asistencia finalizada" icon={{ ios: 'clock', android: 'schedule' }} />
                <View style={styles.statRow}>
                  <StatCard testID="reports-volunteers" label="Voluntarios" value={number(data.summary.volunteersParticipated)}
                    caption="participaron" icon={{ ios: 'person.2', android: 'group' }} />
                  <StatCard testID="reports-activities" label="Actividades" value={number(data.summary.activitiesHeld)}
                    caption={data.summary.activitiesHeld === 1 ? 'finalizada' : 'finalizadas'} icon={{ ios: 'calendar', android: 'event_available' }} />
                </View>
              </View>

              <Section title="Horas por voluntario">
                {data.volunteers.rows.map((row) => (
                  <Row key={row.volunteerId} testID={`reports-volunteer-${row.volunteerId}`}
                    leading={<Avatar name={`${row.firstName} ${row.lastName}`} />}
                    label={`${row.firstName} ${row.lastName}`}
                    value={`${formatHours(row.hours)} · ${plural(row.completedActivities, 'actividad', 'actividades')}`}
                    trailing={row.status === 'inactive' ? <StatusBadge label="Inactivo" tone="neutral" /> : undefined}
                    onPress={() => router.push({ pathname: '/voluntarios/[id]', params: { id: row.volunteerId } })} />
                ))}
                <Row testID="reports-volunteers-all" icon={{ ios: 'list.bullet', android: 'format_list_bulleted' }}
                  label="Ver todos" note={plural(data.volunteers.total, 'voluntario', 'voluntarios')}
                  onPress={() => openList('/reportes/voluntarios')} />
              </Section>

              <Section title="Asistencia por actividad">
                {data.activities.rows.map((row) => (
                  <Row key={row.activityId} testID={`reports-activity-${row.activityId}`}
                    icon={{ ios: 'calendar', android: 'event' }}
                    label={row.name}
                    value={`${shortDay(row.startsAt)} · ${row.presentCount + row.lateCount} de ${row.recordCount} asistieron · ${formatHours(row.totalHours)}`}
                    onPress={() => router.push({ pathname: '/actividades/[id]', params: { id: row.activityId } })} />
                ))}
                <Row testID="reports-activities-all" icon={{ ios: 'list.bullet', android: 'format_list_bulleted' }}
                  label="Ver todas" note={plural(data.activities.total, 'actividad', 'actividades')}
                  onPress={() => openList('/reportes/actividades')} />
              </Section>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorBlock: { gap: 16 },
  stats: { gap: 12 },
  statRow: { flexDirection: 'row', gap: 12 },
  pending: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14,
    borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.accent, backgroundColor: Brand.accentLight,
  },
  pendingText: { flex: 1, fontFamily: AppFonts.body, fontSize: 14, lineHeight: 20, color: Brand.accentText },
});
