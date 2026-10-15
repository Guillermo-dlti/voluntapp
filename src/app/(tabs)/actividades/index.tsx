import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActivityRow } from '@/components/activity-row';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FilterChips } from '@/components/filter-chips';
import { Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { ToggleChip } from '@/components/toggle-chip';
import { SkeletonList } from '@/components/skeleton';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { listActivities, type ActivitySummary, type WhenFilter } from '@/services/activities';

const whenOptions = [
  { value: 'upcoming', label: 'Próximas' },
  { value: 'pending', label: 'Por finalizar' },
  { value: 'past', label: 'Pasadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
] as const;

const emptyCopy: Record<WhenFilter, { title: string; body: string }> = {
  upcoming: { title: 'No hay actividades próximas', body: 'Las actividades en borrador o publicadas que aún no terminan aparecen aquí, la más cercana primero.' },
  pending: { title: 'Nada por finalizar', body: 'Las actividades que ya empezaron y aún no tienen la asistencia finalizada aparecen aquí, la más antigua primero. Sus horas no cuentan hasta finalizarla.' },
  past: { title: 'Sin actividades pasadas', body: 'Cuando una actividad termine o se cierre, aparecerá aquí con sus participantes.' },
  cancelled: { title: 'No hay actividades canceladas', body: 'Si cancelas una actividad, se conserva aquí con sus asignaciones.' },
  all: { title: 'Todavía no hay actividades', body: 'Cuando Coordinación cree la primera actividad, aparecerá aquí.' },
};

const mineNote = 'Solo ves las actividades que supervisas. Quita el filtro para ver todas.';
const isWhen = (value: unknown): value is WhenFilter => whenOptions.some((option) => option.value === value);

export default function ActivitiesScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const params = useLocalSearchParams<{ when?: string; mine?: string }>();
  const supervisor = user?.role === 'supervisor';
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [when, setWhen] = useState<WhenFilter>('upcoming');
  // Supervisors start on their own activities; screen state, so it resets when the app restarts.
  const [mine, setMine] = useState(supervisor);
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

  // A dashboard link sets the filter explicitly, then the params are cleared so a second tap of the
  // same link applies again and a chip tapped later is never overridden. Unknown values are ignored.
  useFocusEffect(useCallback(() => {
    if (params.when === undefined && params.mine === undefined) return;
    if (isWhen(params.when)) setWhen(params.when);
    if (supervisor && params.when !== undefined) setMine(params.mine === 'true');
    setState('loading');
    router.setParams({ when: undefined, mine: undefined });
  }, [params.when, params.mine, supervisor, router]));

  const load = useCallback(async (target: number) => {
    const request = ++latest.current;
    if (target > 1) setLoadingMore(true);
    try {
      const result = await listActivities({ q: search, when, page: target, mine: supervisor && mine });
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
  }, [search, when, mine, supervisor, refresh]);

  // Reloads when the tab regains focus too, so a change made in the detail shows up.
  useFocusEffect(useCallback(() => { void load(1); }, [load]));

  if (!user) return null;
  const canEdit = roleCan.editActivities(user.role);
  const searching = search.trim().length >= 2;
  const filtered = supervisor && mine;
  const emptyBody = searching ? 'Ninguna actividad coincide con ese nombre. Revisa la ortografía o cambia el filtro.'
    : when === 'upcoming' && canEdit ? 'Crea una con el botón “Nueva actividad”. Quedará en borrador hasta que la publiques.'
      : emptyCopy[when].body;

  return (
    <Screen
      testID="activities-screen"
      title="Actividades"
      band={<>
        <SearchField testID="activities-search" value={query} onChangeText={setQuery} placeholder="Buscar por nombre" />
        <FilterChips testID="activities-when" options={whenOptions} value={when} onDark
          onChange={(next) => { setWhen(next); setState('loading'); }} />
        {supervisor ? (
          <ToggleChip testID="activities-mine" label="Solo mis actividades" value={mine}
            onChange={(next) => { setMine(next); setState('loading'); }} />
        ) : null}
      </>}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load(1); }}
      onEndReached={() => { if (hasMore && !loadingMore && state === 'ready') void load(page + 1); }}
      floating={canEdit ? (
        <Fab testID="activities-new" label="Nueva actividad" icon={{ ios: 'plus', android: 'add' }}
          onPress={() => router.push('/actividades/nueva')} />
      ) : undefined}>
      {state === 'loading' ? (
        <SkeletonList variant="activity" rows={4} label="Cargando actividades…" />
      ) : state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar la lista" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(1); }} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState testID="activities-empty"
          icon={searching ? { ios: 'magnifyingglass', android: 'search_off' } : { ios: 'calendar', android: 'calendar_month' }}
          title={searching ? 'Sin resultados' : emptyCopy[when].title}
          body={filtered ? `${emptyBody}\n\n${mineNote}` : emptyBody} />
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

const styles = StyleSheet.create({
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorBlock: { gap: 16 },
});
