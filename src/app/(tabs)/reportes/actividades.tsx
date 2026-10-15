import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExportActions } from '@/components/export-actions';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { AppFonts, Brand } from '@/constants/theme';
import { useReportList } from '@/hooks/use-report-list';
import { listActivityAttendance, type ActivityAttendanceRow } from '@/services/reports';
import { formatHours, plural, rangeErrors, rangeLabel } from '@/utils/report-range';
import { formatSchedule } from '@/utils/time';

function detail(row: ActivityAttendanceRow): string {
  const counts = [plural(row.presentCount, 'presente', 'presentes')];
  if (row.lateCount) counts.push(plural(row.lateCount, 'retardo', 'retardos'));
  if (row.absentCount) counts.push(plural(row.absentCount, 'falta', 'faltas'));
  return `${formatSchedule(row.startsAt, row.endsAt)}\n${counts.join(', ')} de ${row.recordCount} · ${formatHours(row.totalHours)}`;
}

export default function ActivityAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from: string; to: string }>();
  const range = useMemo(() => ({ from: String(params.from ?? ''), to: String(params.to ?? '') }), [params.from, params.to]);
  const valid = !Object.keys(rangeErrors(range)).length;
  const fetchPage = useCallback((offset: number, limit: number) => listActivityAttendance(range, offset, limit), [range]);
  const list = useReportList(fetchPage);

  return (
    <Screen
      testID="reports-activities-screen"
      title="Asistencia por actividad"
      subtitle={valid ? rangeLabel(range) : undefined}
      onBack={() => router.back()}
      refreshing={list.refreshing}
      onRefresh={list.pullToRefresh}
      onEndReached={list.loadMore}>
      {list.state === 'loading' ? (
        <SkeletonList variant="detail" rows={6} label="Cargando actividades…" />
      ) : list.state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar la lista" body={list.message} />
          <Button label="Reintentar" variant="secondary" onPress={list.reload} />
        </View>
      ) : (
        <>
          <ExportActions testID="reports-activities-export" kind="activity-attendance" range={range} total={list.total} />
          {list.rows.length === 0 ? (
            <EmptyState testID="reports-activities-empty" icon={{ ios: 'calendar', android: 'event_busy' }}
              title="No hay actividades finalizadas en este periodo"
              body="Una actividad aparece aquí cuando se finaliza su asistencia. Las que siguen abiertas no se cuentan todavía." />
          ) : (
            <Section footer={`${plural(list.total, 'actividad finalizada', 'actividades finalizadas')}, de la más reciente a la más antigua.`}>
              {list.rows.map((row) => (
                <Row key={row.activityId} testID={`reports-activity-${row.activityId}`}
                  icon={{ ios: 'calendar', android: 'event' }}
                  label={row.name}
                  value={detail(row)}
                  onPress={() => router.push({ pathname: '/actividades/[id]', params: { id: row.activityId } })} />
              ))}
            </Section>
          )}
        </>
      )}
      {list.loadingMore ? <ActivityIndicator color={Brand.primary} /> : null}
      {list.state === 'ready' && list.message && !list.loadingMore ? <Text style={styles.muted}>{list.message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorBlock: { gap: 16 },
});
