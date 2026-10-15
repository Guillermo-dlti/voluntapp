import { ApiError, apiRequest } from '@/services/api';
import { isSummary, type ActivitySummary } from '@/services/activities';

export interface DashboardKpis {
  activeVolunteers: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
}

export interface OwnCounts {
  today: number;
  pending: number;
}

// The server picks the scope from the session role: 'all' carries the KPIs, 'own' a supervisor's counts.
export type Dashboard =
  | { scope: 'all'; kpis: DashboardKpis; own: null; upcoming: ActivitySummary[]; pending: ActivitySummary[] }
  | { scope: 'own'; kpis: null; own: OwnCounts; upcoming: ActivitySummary[]; pending: ActivitySummary[] };

const malformed = () => new ApiError('Recibimos una respuesta inesperada del servidor. Inténtalo de nuevo.');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function summaries(value: unknown): ActivitySummary[] {
  if (!Array.isArray(value)) throw malformed();
  const rows = value.filter(isSummary);
  if (rows.length !== value.length) throw malformed();
  return rows;
}

export async function getDashboard(): Promise<Dashboard> {
  const result = await apiRequest('/api/dashboard');
  if (!isRecord(result)) throw malformed();
  const upcoming = summaries(result.upcoming);
  const pending = summaries(result.pending);
  const { kpis, own } = result;
  if (result.scope === 'all' && own === null && isRecord(kpis) && count(kpis.activeVolunteers) && count(kpis.activitiesThisMonth)
    && typeof kpis.hoursThisMonth === 'number' && kpis.hoursThisMonth >= 0) {
    return {
      scope: 'all', own: null, upcoming, pending,
      kpis: { activeVolunteers: kpis.activeVolunteers, activitiesThisMonth: kpis.activitiesThisMonth, hoursThisMonth: kpis.hoursThisMonth },
    };
  }
  if (result.scope === 'own' && kpis === null && isRecord(own) && count(own.today) && count(own.pending)) {
    return { scope: 'own', kpis: null, own: { today: own.today, pending: own.pending }, upcoming, pending };
  }
  throw malformed();
}
