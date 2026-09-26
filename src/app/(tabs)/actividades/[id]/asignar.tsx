import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Row, Section } from '@/components/grouped-list';
import { Screen } from '@/components/screen';
import { SearchField } from '@/components/search-field';
import { StatusBadge } from '@/components/status-badge';
import { AppFonts, Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { ApiError, apiMessage } from '@/services/api';
import { assignVolunteer, getActivity, type ActivityDetail } from '@/services/activities';
import { listVolunteers, type VolunteerSummary } from '@/services/volunteers';
import { formatPhone } from '@/utils/volunteer-rules';

// Picks one active volunteer for the activity. Tapping assigns right away and returns to the detail;
// a refusal (full, busy at that time) stays here with the API's plain sentence.
export default function AssignVolunteerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useAuth();
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<VolunteerSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const latest = useRef(0);

  const signOutOn401 = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { void refresh(); return true; }
    return false;
  }, [refresh]);

  useEffect(() => {
    getActivity(id).then(setDetail).catch((cause: unknown) => { if (!signOutOn401(cause)) setMessage(apiMessage(cause)); });
  }, [id, signOutOn401]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (target: number) => {
    const request = ++latest.current;
    if (target > 1) setLoadingMore(true);
    try {
      const result = await listVolunteers({ q: search, status: 'active', page: target });
      if (request !== latest.current) return;
      setItems((current) => (target === 1 ? result.volunteers : [...current, ...result.volunteers]));
      setPage(target);
      setHasMore(result.hasMore);
      setState('ready');
    } catch (cause: unknown) {
      if (request !== latest.current || signOutOn401(cause)) return;
      setMessage(apiMessage(cause));
      if (target === 1) setState('error');
    } finally {
      if (request === latest.current) setLoadingMore(false);
    }
  }, [search, signOutOn401]);

  useEffect(() => { void load(1); }, [load]);

  async function assign(volunteer: VolunteerSummary) {
    if (assigning) return;
    setAssigning(volunteer.id);
    setMessage('');
    try {
      await assignVolunteer(id, volunteer.id);
      router.back();
    } catch (cause: unknown) {
      if (signOutOn401(cause)) return;
      setMessage(apiMessage(cause, 'No pudimos asignar a esta persona. Inténtalo de nuevo.'));
    } finally { setAssigning(null); }
  }

  const assignedIds = new Set(detail?.participants.filter((entry) => entry.status === 'assigned').map((entry) => entry.volunteerId));
  const searching = search.trim().length >= 2;

  return (
    <Screen testID="activity-assign-screen" title="Asignar voluntario" onBack={() => router.back()}
      subtitle={detail ? `${detail.activity.name} · ${detail.activity.assignedCount}/${detail.activity.capacity} asignados` : undefined}
      band={<SearchField testID="assign-search" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, correo o teléfono" />}
      onEndReached={() => { if (hasMore && !loadingMore && state === 'ready') void load(page + 1); }}>
      {message ? <View accessibilityRole="alert" style={styles.alert}><Text style={styles.alertText}>{message}</Text></View> : null}
      {state === 'loading' ? (
        <Card><View style={styles.loading}><ActivityIndicator color={Brand.primary} /><Text style={styles.muted}>Cargando voluntarios…</Text></View></Card>
      ) : state === 'error' ? (
        <Button label="Reintentar" variant="secondary" onPress={() => { setState('loading'); void load(1); }} />
      ) : items.length === 0 ? (
        <EmptyState icon={searching ? { ios: 'magnifyingglass', android: 'search_off' } : { ios: 'person.2', android: 'group' }}
          title={searching ? 'Sin resultados' : 'No hay voluntarios activos'}
          body={searching ? 'Nadie activo coincide con esa búsqueda. Revisa la ortografía o busca por teléfono.'
            : 'Solo se asignan voluntarios activos. Registra o reactiva a alguien en la pestaña Voluntarios.'} />
      ) : (
        <Section title="Voluntarios activos" footer="Toca a una persona para asignarla.">
          {items.map((volunteer) => {
            const already = assignedIds.has(volunteer.id);
            const name = `${volunteer.firstName} ${volunteer.lastName}`;
            return (
              <Row key={volunteer.id} testID={`assign-row-${volunteer.id}`} leading={<Avatar name={name} />} label={name}
                value={formatPhone(volunteer.phone)} disabled={already || assigning !== null} chevron={false}
                trailing={already ? <StatusBadge label="Ya asignado" tone="success" />
                  : assigning === volunteer.id ? <ActivityIndicator color={Brand.primary} /> : undefined}
                onPress={already ? undefined : () => void assign(volunteer)} />
            );
          })}
        </Section>
      )}
      {loadingMore ? <ActivityIndicator color={Brand.primary} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  muted: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },
  alert: { backgroundColor: Brand.dangerLight, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  alertText: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.dangerText, lineHeight: 20 },
});
