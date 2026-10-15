import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { SkeletonReport } from '@/components/skeleton';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useReportExport } from '@/hooks/use-report-export';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import {
  getSummary, listVolunteerHours, savesToFolder,
  type ReportKind, type ReportPage, type ReportSummary, type VolunteerHoursRow,
} from '@/services/reports';
import {
  formatHours, formatHoursNumber, plural, presetRange, rangeErrors, rangeLabel, type RangePreset, type ReportRange,
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

const isPreset = (value: unknown): value is Exclude<RangePreset, 'custom'> =>
  value === 'thisMonth' || value === 'lastMonth' || value === 'thisYear';

export default function ReportsScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const params = useLocalSearchParams<{ preset?: string }>();
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

  // A dashboard link sets the period explicitly, then the param is cleared so a second tap applies again
  // and a chip tapped later is never overridden. Unknown values are ignored.
  useFocusEffect(useCallback(() => {
    if (params.preset === undefined) return;
    if (isPreset(params.preset)) setPreset(params.preset);
    router.setParams({ preset: undefined });
  }, [params.preset, router]));

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
        <EmptyState bare icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar el reporte" body={message}
          action={{ label: 'Reintentar', onPress: () => { setState('loading'); void load(); } }} />
      ) : state === 'loading' || !data ? (
        <SkeletonReport />
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
                title="Nada finalizado en este periodo"
                body="Los reportes solo cuentan asistencia finalizada. Las horas aparecen aquí al finalizarla." />
              <DownloadCard range={range} volunteers={data.volunteers.total} activities={data.summary.activitiesHeld} />
            </>
          ) : (
            <>
              <SummarySection summary={data.summary} top={data.volunteers.rows}
                onOpenVolunteer={(id) => router.push({ pathname: '/voluntarios/[id]', params: { id } })} />

              <Section title="Ver detalle" inset="icon">
                <Row testID="reports-volunteers-all" icon={{ ios: 'person.2', android: 'group' }}
                  label="Horas por voluntario" note={plural(data.volunteers.total, 'voluntario', 'voluntarios')}
                  onPress={() => openList('/reportes/voluntarios')} />
                <Row testID="reports-activities-all" icon={{ ios: 'calendar', android: 'event' }}
                  label="Asistencia por actividad" note={plural(data.summary.activitiesHeld, 'actividad', 'actividades')}
                  onPress={() => openList('/reportes/actividades')} />
              </Section>

              <DownloadCard range={range} volunteers={data.volunteers.total} activities={data.summary.activitiesHeld} />
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
          {/* The period's totals in one quiet line; the big numbers for this month live on Inicio. */}
          {/* The period's hours lead as one big number (after Flighty's "12 total aircraft"); people and
              activities follow in one line under it. */}
          <View testID="reports-totals" accessible
            accessibilityLabel={`${formatHours(summary.totalHours)}, ${plural(summary.volunteersParticipated, 'voluntario', 'voluntarios')}, ${plural(summary.activitiesHeld, 'actividad', 'actividades')}`}
            style={styles.totalsBlock}>
            <View style={styles.headlineRow}>
              <Text style={styles.headline}>{formatHoursNumber(summary.totalHours)}</Text>
              <Text style={styles.headlineUnit}>{summary.totalHours === 1 ? 'hora' : 'horas'}</Text>
            </View>
            <Text style={styles.totals}>
              {`${plural(summary.volunteersParticipated, 'voluntario', 'voluntarios')} · ${plural(summary.activitiesHeld, 'actividad', 'actividades')}`}
            </Text>
            <Text style={styles.totalsNote}>Solo cuenta la asistencia finalizada del periodo.</Text>
          </View>
          <View style={styles.hairline} />
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

  // Picking a file keeps the sheet open and only changes its rows; save or share closes it first.
  const actions: SheetAction[] = chosen ? [
    ...(savesToFolder ? [{ label: 'Guardar en el teléfono', icon: { ios: 'arrow.down.circle', android: 'download' }, testID: 'reports-download-save',
      onPress: () => { void run(chosen.kind, 'download'); } } satisfies SheetAction] : []),
    { label: savesToFolder ? 'Compartir' : 'Guardar o compartir', icon: { ios: 'square.and.arrow.up', android: 'share' }, testID: 'reports-download-share',
      detail: savesToFolder ? undefined : 'Para guardarlo, elige “Guardar en Archivos”', onPress: () => { void run(chosen.kind, 'share'); } },
  ] : files.map((file) => ({
    label: file.title,
    icon: file.icon,
    testID: file.testID,
    disabled: rows[file.kind] === 0,
    detail: rows[file.kind] === 0 ? 'Sin filas en este periodo' : `${file.detail} · ${plural(rows[file.kind], 'fila', 'filas')}`,
    keepOpen: true,
    onPress: () => { setStep(file.kind); },
  }));

  return (
    <Card testID="reports-download">
      <View style={styles.download}>
        <View style={styles.downloadHead}>
          <View style={styles.iconWell}><Icon name={{ ios: 'arrow.down.doc', android: 'file_download' }} size={18} color={Brand.primary} /></View>
          <Text style={styles.downloadTitle}>Descargar reporte (CSV)</Text>
        </View>
        <Button testID="reports-download-open" label="Elegir archivo" variant="secondary"
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
  summary: { gap: Spacing.lg },
  totalsBlock: { gap: 2 },
  headlineRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  headline: { fontFamily: Type.title.fontFamily, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: Brand.text, fontVariant: ['tabular-nums'] },
  headlineUnit: { ...Type.bodyStrong, color: Brand.textSecondary },
  totals: { ...Type.calloutStrong, color: Brand.text },
  totalsNote: { ...Type.footnote, color: Brand.textTertiary },
  chart: { gap: 10 },
  chartTitle: { ...Type.headline, color: Brand.text },
  chartEmpty: { ...Type.callout, color: Brand.textSecondary },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border },
  download: { gap: 14 },
  downloadHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWell: { width: 34, height: 34, borderRadius: Radius.well, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  downloadTitle: { flex: 1, ...Type.headline, color: Brand.text },
  fields: { gap: Spacing.lg },
  pending: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14,
    borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.accent, backgroundColor: Brand.accentLight,
  },
  pendingText: { flex: 1, ...Type.callout, color: Brand.accentText },
});
