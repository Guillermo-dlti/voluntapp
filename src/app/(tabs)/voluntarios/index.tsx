import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FilterChips } from '@/components/filter-chips';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StatusBadge } from '@/components/status-badge';
import { roleCan } from '@/constants/roles';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { listVolunteers, type StatusFilter, type VolunteerSummary } from '@/services/volunteers';
import { formatPhone } from '@/utils/volunteer-rules';

const statusOptions = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
] as const;

export default function VolunteersScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [items, setItems] = useState<VolunteerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Only the newest request may update the list, so a slow earlier search can't overwrite a newer one.
  const latest = useRef(0);

  // Waits for a pause in typing instead of querying on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (target: number) => {
    const request = ++latest.current;
    if (target > 1) setLoadingMore(true);
    try {
      const result = await listVolunteers({ q: search, status, page: target });
      if (request !== latest.current) return;
      setItems((current) => (target === 1 ? result.volunteers : [...current, ...result.volunteers]));
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
  }, [search, status, refresh]);

  // Reloads when the tab regains focus too, so a volunteer just created or edited shows up.
  useFocusEffect(useCallback(() => { void load(1); }, [load]));

  if (!user) return null;
  const canEdit = roleCan.editVolunteers(user.role);
  const searching = search.trim().length >= 2;

  return (
    <Screen
      testID="volunteers-screen"
      title="Voluntarios"
      band={<>
        <SearchField testID="volunteers-search" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, correo o teléfono" />
        <FilterChips testID="volunteers-status" options={statusOptions} value={status} onDark
          onChange={(next) => { setStatus(next); setState('loading'); }} />
      </>}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load(1); }}
      onEndReached={() => { if (hasMore && !loadingMore && state === 'ready') void load(page + 1); }}
      floating={canEdit ? (
        <Fab testID="volunteers-new" label="Nuevo voluntario" icon={{ ios: 'plus', android: 'person_add' }}
          onPress={() => router.push('/voluntarios/nuevo')} />
      ) : undefined}>
      {state === 'loading' ? (
        <Card><View style={styles.loading}><ActivityIndicator color={Brand.primary} /><Text style={styles.muted}>Cargando voluntarios…</Text></View></Card>
      ) : state === 'error' ? (
        <View style={styles.errorBlock}>
          <EmptyState icon={{ ios: 'wifi.exclamationmark', android: 'cloud_off' }} title="No pudimos cargar la lista" body={message} />
          <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(1); }} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState testID="volunteers-empty"
          icon={searching ? { ios: 'magnifyingglass', android: 'search_off' } : { ios: 'person.2', android: 'group' }}
          title={searching ? 'Sin resultados' : status === 'inactive' ? 'No hay voluntarios inactivos' : 'Todavía no hay voluntarios'}
          body={searching
            ? 'Nadie coincide con esa búsqueda. Revisa la ortografía o busca por teléfono.'
            : status === 'inactive'
              ? 'Cuando desactives a alguien, aparecerá aquí con su historial completo.'
              : canEdit ? 'Registra a la primera persona con el botón “Nuevo voluntario”.' : 'Cuando Coordinación registre voluntarios, aparecerán aquí.'} />
      ) : (
        <Section title={searching ? 'Resultados' : undefined}>
          {items.map((volunteer) => (
            <Row key={volunteer.id} testID={`volunteer-row-${volunteer.id}`}
              leading={<Avatar name={`${volunteer.firstName} ${volunteer.lastName}`} />}
              label={`${volunteer.firstName} ${volunteer.lastName}`}
              value={formatPhone(volunteer.phone)}
              trailing={volunteer.status === 'inactive' ? <StatusBadge label="Inactivo" tone="neutral" /> : undefined}
              onPress={() => router.push({ pathname: '/voluntarios/[id]', params: { id: volunteer.id } })} />
          ))}
        </Section>
      )}
      {loadingMore ? <ActivityIndicator color={Brand.primary} /> : null}
      {state === 'ready' && message && items.length > 0 && !loadingMore ? <Text style={styles.muted}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  errorBlock: { gap: 16 },
});
