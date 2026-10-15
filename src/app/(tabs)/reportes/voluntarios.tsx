import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ExportActions } from '@/components/export-actions';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { StatusBadge } from '@/components/status-badge';
import { SkeletonList } from '@/components/skeleton';
import { AppFonts, Brand } from '@/constants/theme';
import { useReportList } from '@/hooks/use-report-list';
import { listVolunteerHours, type VolunteerHoursRow } from '@/services/reports';
import { formatHours, plural, rangeErrors, rangeLabel } from '@/utils/report-range';

function detail(row: VolunteerHoursRow): string {
  const parts = [formatHours(row.hours), plural(row.completedActivities, 'actividad', 'actividades')];
  if (row.lateCount) parts.push(plural(row.lateCount, 'retardo', 'retardos'));
  if (row.absentCount) parts.push(plural(row.absentCount, 'falta', 'faltas'));
  return parts.join(' · ');
}

export default function VolunteerHoursScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from: string; to: string }>();
  const range = useMemo(() => ({ from: String(params.from ?? ''), to: String(params.to ?? '') }), [params.from, params.to]);
  const valid = !Object.keys(rangeErrors(range)).length;
  const fetchPage = useCallback((offset: number, limit: number) => listVolunteerHours(range, offset, limit), [range]);
  const list = useReportList(fetchPage);

  return (
    <Screen
      testID="reports-volunteers-screen"
      title="Horas por voluntario"
      subtitle={valid ? rangeLabel(range) : undefined}
      onBack={() => router.back()}
      refreshing={list.refreshing}
      onRefresh={list.pullToRefresh}
      onEndReached={list.loadMore}>
      {list.state === 'loading' ? (
        <SkeletonList variant="person" rows={6} label="Cargando voluntarios…" />
      ) : list.state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar la lista" body={list.message} />
          <Button label="Reintentar" variant="secondary" onPress={list.reload} />
        </View>
      ) : (
        <>
          <ExportActions testID="reports-volunteers-export" kind="volunteer-hours" range={range} total={list.total} />
          {list.rows.length === 0 ? (
            <EmptyState testID="reports-volunteers-empty" icon={{ ios: 'person.2', android: 'group' }}
              title="No hay voluntarios en este reporte"
              body="Aquí aparecen todos los voluntarios activos, y los inactivos que tienen asistencia finalizada en el periodo." />
          ) : (
            <Section footer={`${plural(list.total, 'voluntario', 'voluntarios')}, de más a menos horas. Solo cuenta la asistencia finalizada.`}>
              {list.rows.map((row) => (
                <Row key={row.volunteerId} testID={`reports-volunteer-${row.volunteerId}`}
                  leading={<Avatar name={`${row.firstName} ${row.lastName}`} />}
                  label={`${row.firstName} ${row.lastName}`}
                  value={detail(row)}
                  trailing={row.status === 'inactive' ? <StatusBadge label="Inactivo" tone="neutral" /> : undefined}
                  onPress={() => router.push({ pathname: '/voluntarios/[id]', params: { id: row.volunteerId } })} />
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
