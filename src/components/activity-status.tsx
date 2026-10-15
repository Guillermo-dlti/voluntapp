import { StatusBadge } from '@/components/status-badge';
import type { ActivitySummary } from '@/services/activities';
import { stepBadge } from '@/utils/activity-flow';

type Timing = Pick<ActivitySummary, 'status' | 'startsAt' | 'attendanceStartedAt' | 'attendanceFinalizedAt'>;

// An activity's pill says its step (Borrador, Publicada, Por finalizar, Finalizada, Cancelada), the
// same word the progress strip uses, rather than the stored status.
export function ActivityStepBadge({ activity }: { activity: Timing }) {
  const { label, tone } = stepBadge(activity);
  return <StatusBadge label={label} tone={tone} />;
}
