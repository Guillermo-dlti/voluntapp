import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { HorizontalBars, StackedBar } from '@/components/bar-chart';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { ExportMessage } from '@/components/export-actions';
import { FilterChips } from '@/components/filter-chips';
import { Row, Section } from '@/components/grouped-list';
import { Icon } from '@/components/icon';
import { attendanceTones } from '@/components/roll-call-row';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useReportExport } from '@/hooks/use-report-export';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  getSummary, listVolunteerHours,
  type ReportKind, type ReportPage, type ReportSummary, type VolunteerHoursRow,
} from '@/services/reports';
import {
  formatHours, plural, presetRange, rangeErrors, rangeLabel, type RangePreset, type ReportRange,
} from '@/utils/report-range';
import { todayInMexico } from '@/utils/time';

// Volunteers in the "Más horas" chart.
const TOP_ROWS = 5;
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
      const [summary, volunteers] = await Promise.all([
        getSummary(period), listVolunteerHours(period, 0, TOP_ROWS),
      ]);
      if (request !== latest.current) return;
      setData({ summary, volunteers });
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
            <>
              <EmptyState testID="reports-empty" icon={{ ios: 'chart.bar', android: 'bar_chart' }}
                title="No hay actividades finalizadas en este periodo"
                body="Los reportes solo cuentan asistencia finalizada. Cuando se finalice la asistencia de una actividad de este periodo, sus horas aparecerán aquí." />
              <DownloadCard range={range} volunteers={data.volunteers.total} activities={data.summary.activitiesHeld} />
            </>
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

              <SummarySection summary={data.summary} top={data.volunteers.rows}
                onOpenVolunteer={(id) => router.push({ pathname: '/voluntarios/[id]', params: { id } })} />

              <DownloadCard range={range} volunteers={data.volunteers.total} activities={data.summary.activitiesHeld} />

              <Section title="Ver detalle">
                <Row testID="reports-volunteers-all" icon={{ ios: 'person.2', android: 'group' }}
                  label="Horas por voluntario" note={plural(data.volunteers.total, 'voluntario', 'voluntarios')}
                  onPress={() => openList('/reportes/voluntarios')} />
                <Row testID="reports-activities-all" icon={{ ios: 'calendar', android: 'event' }}
                  label="Asistencia por actividad" note={plural(data.summary.activitiesHeld, 'actividad', 'actividades')}
                  onPress={() => openList('/reportes/actividades')} />
              </Section>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// The two common questions answered on screen: who gave the most hours, and how attendance went.
function SummarySection({ summary, top, onOpenVolunteer }: {
  summary: ReportSummary; top: VolunteerHoursRow[]; onOpenVolunteer: (id: string) => void;
}) {
  const withHours = top.filter((row) => row.hours > 0);
  const attendanceTotal = summary.presentCount + summary.lateCount + summary.absentCount;
  return (
    <Section title="Resumen" bare>
      <Card testID="reports-summary">
        <View style={styles.summary}>
          <View style={styles.chart}>
            <Text accessibilityRole="header" style={styles.chartTitle}>Más horas</Text>
            {withHours.length === 0 ? <Text style={styles.chartEmpty}>Nadie sumó horas en este periodo.</Text> : (
              <HorizontalBars testID="reports-top-volunteers" items={withHours.map((row) => ({
                key: row.volunteerId,
                label: `${row.firstName} ${row.lastName}`,
                value: row.hours,
                valueLabel: formatHours(row.hours),
                onPress: () => onOpenVolunteer(row.volunteerId),
              }))} />
            )}
          </View>
          <View style={styles.hairline} />
          <View style={styles.chart}>
            <Text accessibilityRole="header" style={styles.chartTitle}>Asistencia</Text>
            {attendanceTotal === 0 ? <Text style={styles.chartEmpty}>Sin registros de asistencia en este periodo.</Text> : (
              <StackedBar testID="reports-attendance-split" segments={[
                { key: 'present', label: 'Presentes', count: summary.presentCount, tone: attendanceTones.present },
                { key: 'late', label: 'Tarde', count: summary.lateCount, tone: attendanceTones.late },
                { key: 'absent', label: 'Faltas', count: summary.absentCount, tone: attendanceTones.absent },
              ]} />
            )}
          </View>
        </View>
      </Card>
    </Section>
  );
}

const files: readonly { kind: ReportKind; title: string; detail: string; icon: Parameters<typeof Icon>[0]['name']; testID: string }[] = [
  {
    kind: 'volunteer-hours', title: 'Horas por voluntario', testID: 'reports-download-volunteers',
    detail: 'Una fila por voluntario con sus horas', icon: { ios: 'person.2', android: 'group' },
  },
  {
    kind: 'activity-attendance', title: 'Asistencia por actividad', testID: 'reports-download-activities',
    detail: 'Una fila por actividad con presentes, retardos y faltas', icon: { ios: 'calendar', android: 'event' },
  },
];

// One card for both files: a sheet asks which file, then whether to save it or share it.
function DownloadCard({ range, volunteers, activities }: { range: ReportRange; volunteers: number; activities: number }) {
  const { busy, message, run } = useReportExport(range);
  // null: closed. 'file': picking the file. A kind: picking save or share for that file.
  const [step, setStep] = useState<'file' | ReportKind | null>(null);
  const rows: Record<ReportKind, number> = { 'volunteer-hours': volunteers, 'activity-attendance': activities };
  const empty = volunteers === 0 && activities === 0;
  const chosen = step && step !== 'file' ? files.find((file) => file.kind === step) : undefined;

  // ActionSheet closes before running an action; picking a file sets the next step in the same
  // render, so the sheet stays open and only its rows change.
  const actions: SheetAction[] = chosen ? [
    { label: 'Guardar en el teléfono', icon: { ios: 'arrow.down.circle', android: 'download' }, testID: 'reports-download-save',
      onPress: () => { void run(chosen.kind, 'download'); } },
    { label: 'Compartir', icon: { ios: 'square.and.arrow.up', android: 'share' }, testID: 'reports-download-share',
      onPress: () => { void run(chosen.kind, 'share'); } },
  ] : files.map((file) => ({
    label: file.title,
    icon: file.icon,
    testID: file.testID,
    disabled: rows[file.kind] === 0,
    detail: rows[file.kind] === 0 ? 'Sin filas en este periodo' : `${file.detail} · ${plural(rows[file.kind], 'fila', 'filas')}`,
    onPress: () => { setStep(file.kind); },
  }));

  return (
    <Card testID="reports-download">
      <View style={styles.download}>
        <View style={styles.downloadHead}>
          <View style={styles.iconWell}><Icon name={{ ios: 'arrow.down.doc', android: 'file_download' }} size={18} color={Brand.primary} /></View>
          <View style={styles.downloadText}>
            <Text style={styles.downloadTitle}>Descargar reporte completo (CSV)</Text>
            <Text style={styles.downloadPeriod}>{rangeLabel(range)}</Text>
          </View>
        </View>
        <Button testID="reports-download-open" label="Elegir archivo" variant="primary"
          busy={busy !== null} busyLabel={busy === 'share' ? 'Preparando…' : 'Guardando…'} disabled={empty}
          icon={{ ios: 'doc.text', android: 'description' }} onPress={() => { setStep('file'); }} />
        <ExportMessage message={message} empty={empty} />
      </View>
      <ActionSheet testID="reports-download-sheet" visible={step !== null}
        title={chosen ? chosen.title : '¿Qué archivo?'} subtitle={rangeLabel(range)}
        actions={actions} onClose={() => { setStep(null); }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 16 },
  chart: { gap: 10 },
  chartTitle: { fontFamily: AppFonts.headingSemiBold, fontSize: 17, color: Brand.text },
  chartEmpty: { fontFamily: AppFonts.body, fontSize: 14, lineHeight: 20, color: Brand.textSecondary },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border },
  download: { gap: 14 },
  downloadHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWell: { width: 34, height: 34, borderRadius: 10, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  downloadText: { flex: 1, gap: 2 },
  downloadTitle: { fontFamily: AppFonts.headingSemiBold, fontSize: 17, color: Brand.text },
  downloadPeriod: { fontFamily: AppFonts.bodySemiBold, fontSize: 13, color: Brand.textTertiary, marginTop: 2 },
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
