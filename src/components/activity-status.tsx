import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import type { ActivityStatus } from '@/services/activities';

export const activityStatusLabels: Record<ActivityStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Borrador', tone: 'attention' },
  open: { label: 'Publicada', tone: 'success' },
  closed: { label: 'Cerrada', tone: 'neutral' },
  cancelled: { label: 'Cancelada', tone: 'critical' },
};

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const { label, tone } = activityStatusLabels[status];
  return <StatusBadge label={label} tone={tone} />;
}
