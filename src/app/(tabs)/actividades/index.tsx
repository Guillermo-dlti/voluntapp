import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActivityStatusBadge } from '@/components/activity-status';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FilterChips } from '@/components/filter-chips';
import { Section } from '@/components/grouped-list';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { Icon } from '@/components/icon';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { listActivities, type ActivitySummary, type WhenFilter } from '@/services/activities';
import { formatSchedule } from '@/utils/time';

const whenOptions = [
  { value: 'upcoming', label: 'Próximas' },
  { value: 'past', label: 'Pasadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
] as const;

const emptyCopy: Record<WhenFilter, { title: string; body: string }> = {
  upcoming: { title: 'No hay actividades próximas', body: 'Las actividades en borrador o publicadas que aún no terminan aparecen aquí, la más cercana primero.' },
  past: { title: 'Sin actividades pasadas', body: 'Cuando una actividad termine o se cierre, aparecerá aquí con sus participantes.' },
  cancelled: { title: 'No hay actividades canceladas', body: 'Si cancelas una actividad, se conserva aquí con sus asignaciones.' },
  all: { title: 'Todavía no hay actividades', body: 'Cuando Coordinación cree la primera actividad, aparecerá aquí.' },
};

export default function ActivitiesScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [when, setWhen] = useState<WhenFilter>('upcoming');
  const [items, setItems] = useState<ActivitySummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may update the list, so a slow earlier search can't overwrite a newer one.
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (target: number) => {
    const request = ++latest.current;
    if (target > 1) setLoadingMore(true);
    try {
      const result = await listActivities({ q: search, when, page: target });
      if (request !== latest.current) return;
      setItems((current) => (target === 1 ? result.activities : [...current, ...result.activities]));
      setPage(target);
      setHasMore(result.hasMore);
      setMessage('');
      setState('ready');
    } catch (cause: unknown) {
      if (request !== latest.current) return;
      if (cause instanceof ApiError && cause.status === 401) { void refresh(); return; }
      setMessage(apiMessage(cause));
      if (target === 1) setState('error');
    } finally {
      if (request === latest.current) { setLoadingMore(false); setRefreshing(false); }
    }
  }, [search, when, refresh]);

  // Reloads when the tab regains focus too, so a change made in the detail shows up.
  useFocusEffect(useCallback(() => { void load(1); }, [load]));

  if (!user) return null;
  const canEdit = roleCan.editActivities(user.role);
  const searching = search.trim().length >= 2;

  return (
    <Screen
      testID="activities-screen"
      title="Actividades"
      band={<>
        <SearchField testID="activities-search" value={query} onChangeText={setQuery} placeholder="Buscar por nombre" />
        <FilterChips testID="activities-when" options={whenOptions} value={when} onDark
          onChange={(next) => { setWhen(next); setState('loading'); }} />
      </>}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load(1); }}
      onEndReached={() => { if (hasMore && !loadingMore && state === 'ready') void load(page + 1); }}
      floating={canEdit ? (
        <Fab testID="activities-new" label="Nueva actividad" icon={{ ios: 'plus', android: 'add' }}
          onPress={() => router.push('/actividades/nueva')} />
      ) : undefined}>
      {state === 'loading' ? (
        <Card><View style={styles.loading}><ActivityIndicator color={Brand.primary} /><Text style={styles.muted}>Cargando actividades…</Text></View></Card>
      ) : state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar la lista" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(1); }} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState testID="activities-empty"
          icon={searching ? { ios: 'magnifyingglass', android: 'search_off' } : { ios: 'calendar', android: 'calendar_month' }}
          title={searching ? 'Sin resultados' : emptyCopy[when].title}
          body={searching ? 'Ninguna actividad coincide con ese nombre. Revisa la ortografía o cambia el filtro.'
            : when === 'upcoming' && canEdit ? 'Crea una con el botón “Nueva actividad”. Quedará en borrador hasta que la publiques.'
              : emptyCopy[when].body} />
      ) : (
        <Section title={searching ? 'Resultados' : undefined}>
          {items.map((activity) => (
            <ActivityRow key={activity.id} activity={activity}
              onPress={() => router.push({ pathname: '/actividades/[id]', params: { id: activity.id } })} />
          ))}
        </Section>
      )}
      {loadingMore ? <ActivityIndicator color={Brand.primary} /> : null}
      {state === 'ready' && message && items.length > 0 && !loadingMore ? <Text style={styles.muted}>{message}</Text> : null}
    </Screen>
  );
}

// Two lines of detail (schedule, place) plus the fill level, so a row answers "when, where, how full".
function ActivityRow({ activity, onPress }: { activity: ActivitySummary; onPress: () => void }) {
  const full = activity.assignedCount >= activity.capacity;
  return (
    <PressableScale testID={`activity-row-${activity.id}`} accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>{activity.name}</Text>
        <Text style={styles.detail}>{formatSchedule(activity.startsAt, activity.endsAt)}</Text>
        <Text style={styles.detail} numberOfLines={1}>{activity.location}</Text>
        <View style={styles.meta}>
          <ActivityStatusBadge status={activity.status} />
          <Text style={[styles.count, full && styles.countFull]}>{activity.assignedCount}/{activity.capacity} asignados</Text>
        </View>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={Brand.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorBlock: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowText: { flex: 1, gap: 4 },
  name: { fontFamily: AppFonts.bodySemiBold, fontSize: 16, color: Brand.text },
  detail: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  count: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textSecondary },
  countFull: { fontFamily: AppFonts.bodySemiBold, color: Brand.accentText },
});
