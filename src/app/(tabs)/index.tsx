import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ActivityRow } from '@/components/activity-row';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { StatCard } from '@/components/stat-card';
import { SkeletonDashboard } from '@/components/skeleton';
import { roleLabels } from '@/constants/roles';
import { AppFonts, Brand, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import type { ActivitySummary } from '@/services/activities';
import { getDashboard, type Dashboard } from '@/services/dashboard';
import { useMotion } from '@/utils/motion';
import { formatHoursNumber } from '@/utils/report-range';
import { firstName, greeting, todayLabel } from '@/utils/time';

const integer = (value: number) => value.toLocaleString('es-MX');

export default function DashboardScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  // Blocks rise in one after another, on the first load only (later reloads keep them mounted).
  const { enter } = useMotion();
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may update the screen, so a slow earlier answer can't overwrite a newer one.
  const latest = useRef(0);

  // Silent once data is on screen: the old numbers stay until the new answer arrives.
  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const result = await getDashboard();
      if (request !== latest.current) return;
      setData(result);
      setStale(false);
      setState('ready');
    } catch (cause: unknown) {
      if (request !== latest.current) return;
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
      // A later failure keeps the last data with a note; only a failed first load replaces the screen.
      setStale(true);
      setState((current) => (current === 'ready' ? current : 'error'));
    } finally {
      if (request === latest.current) setRefreshing(false);
    }
  }, [refresh]);

  // Reloads every time the tab gains focus, so work done in other tabs shows up.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!user) return null;

  const openActivity = (activity: ActivitySummary) => router.push({ pathname: '/actividades/[id]', params: { id: activity.id } });
  // Every link sets the target filter explicitly and lands on the tab's root list (spec 0008, Route params).
  const openActivities = (when: 'upcoming' | 'pending', mine: boolean) =>
    router.navigate({ pathname: '/actividades', params: mine ? { when, mine: 'true' } : { when } });

  return (
    <Screen testID="home-screen" eyebrow={todayLabel()} title={`${greeting()}, ${firstName(user.fullName)}`} titleTestID="home-greeting"
      band={<View style={styles.roleChip}><Text style={styles.roleText}>{roleLabels[user.role]}</Text></View>}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load(); }}>
      {state === 'loading' ? (
        <SkeletonDashboard layout={user.role === 'supervisor' ? 'pair' : 'hero'} />
      ) : state === 'error' || !data ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar el inicio" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(); }} />
        </View>
      ) : (
        <>
          {stale ? (
            <Text testID="home-stale-note" style={styles.stale}>No se pudo actualizar. Desliza hacia abajo para intentarlo de nuevo.</Text>
          ) : null}

          {data.scope === 'all' ? (
            <Animated.View entering={enter(0)} style={styles.kpis}>
              <PressableScale testID="home-kpi-hours" accessibilityRole="button" accessibilityLabel="Ver horas de este mes en Reportes"
                onPress={() => router.navigate({ pathname: '/reportes', params: { preset: 'thisMonth' } })}>
                <StatCard label="Horas este mes" value={formatHoursNumber(data.kpis.hoursThisMonth)}
                  unit={data.kpis.hoursThisMonth === 1 ? 'hora' : 'horas'} caption="con asistencia finalizada" icon={{ ios: 'clock', android: 'schedule' }} />
              </PressableScale>
              <View style={styles.pair}>
                <PressableScale testID="home-kpi-volunteers" accessibilityRole="button" accessibilityLabel="Ver voluntarios activos"
                  style={styles.half} onPress={() => router.navigate({ pathname: '/voluntarios', params: { status: 'active' } })}>
                  <StatCard label="Voluntarios activos" value={integer(data.kpis.activeVolunteers)} caption="en el padrón"
                    icon={{ ios: 'person.2', android: 'group' }} />
                </PressableScale>
                <PressableScale testID="home-kpi-activities" accessibilityRole="button" accessibilityLabel="Ver próximas actividades"
                  style={styles.half} onPress={() => openActivities('upcoming', false)}>
                  <StatCard label="Actividades este mes" value={integer(data.kpis.activitiesThisMonth)} caption="publicadas o cerradas"
                    icon={{ ios: 'calendar', android: 'calendar_month' }} />
                </PressableScale>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={enter(0)} style={styles.pair}>
              <View testID="home-own-today" style={styles.half} accessible
                accessibilityLabel={`Hoy tienes ${integer(data.own.today)} ${data.own.today === 1 ? 'actividad' : 'actividades'}`}>
                <StatCard label="Hoy" value={integer(data.own.today)} caption="actividades tuyas" icon={{ ios: 'sun.max', android: 'today' }} />
              </View>
              <PressableScale testID="home-own-pending" accessibilityRole="button" style={styles.half}
                accessibilityLabel={`${integer(data.own.pending)} por finalizar. Ver tus actividades con asistencia pendiente`}
                onPress={() => openActivities('pending', true)}>
                <StatCard label="Por finalizar" value={integer(data.own.pending)} caption="asistencia pendiente"
                  icon={{ ios: 'checklist', android: 'pending_actions' }} tone={data.own.pending > 0 ? 'attention' : 'default'} />
              </PressableScale>
            </Animated.View>
          )}

          <Animated.View entering={enter(1)} testID="home-upcoming">
            {data.upcoming.length === 0 ? (
              <Section title="Próximas actividades" bare>
                {data.scope === 'all' ? (
                  <EmptyState icon={{ ios: 'calendar', android: 'calendar_month' }} title="Sin actividades próximas"
                    body="Las actividades en borrador o publicadas que aún no terminan aparecen aquí, la más cercana primero." />
                ) : (
                  <EmptyState icon={{ ios: 'calendar', android: 'calendar_month' }} title="No tienes actividades próximas"
                    body="Cuando Coordinación te asigne como supervisor de una actividad publicada, aparecerá aquí." />
                )}
              </Section>
            ) : (
              <Section title="Próximas actividades">
                {data.upcoming.map((activity) => (
                  <ActivityRow key={activity.id} testID={`home-activity-${activity.id}`} activity={activity} onPress={() => openActivity(activity)} />
                ))}
                <Row testID="home-upcoming-all" label="Ver todas" onPress={() => openActivities('upcoming', data.scope === 'own')} />
              </Section>
            )}
          </Animated.View>

          <Animated.View entering={enter(2)} testID="home-pending">
            {data.pending.length === 0 ? (
              <Section title="Por finalizar" footer="Las horas de un voluntario solo cuentan cuando su asistencia está finalizada.">
                <Row icon={{ ios: 'checkmark.circle', android: 'check_circle' }} label="Nada pendiente"
                  value={data.scope === 'all' ? 'No hay actividades esperando cierre de asistencia.' : 'Ninguna de tus actividades espera cierre de asistencia.'} />
              </Section>
            ) : (
              <Section title="Por finalizar">
                {data.pending.map((activity) => (
                  <ActivityRow key={activity.id} testID={`home-activity-${activity.id}`} activity={activity} onPress={() => openActivity(activity)} />
                ))}
                <Row testID="home-pending-all" label="Ver todas" onPress={() => openActivities('pending', data.scope === 'own')} />
              </Section>
            )}
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleChip: { alignSelf: 'flex-start', backgroundColor: Brand.accent, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  roleText: { fontFamily: AppFonts.bodySemiBold, fontSize: 13, color: Brand.forest },
  errorBlock: { gap: 16 },
  // Pulled toward the KPIs below, since the screen's content gap is wide.
  stale: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', marginBottom: -12 },
  kpis: { gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
