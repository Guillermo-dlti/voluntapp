import { Router } from 'express';
import type { ObjectId } from 'mongodb';
import { z } from 'zod';
import { activityListFilter, ownActivities, summaryProjection, toActivitySummary, type WhenFilter } from './activities.js';
import type { V2Collections } from './collections.js';
import { addDays, mexicoDayStart, mexicoParts } from './common.js';
import { grantFor } from './permissions.js';
import { currentMonthRange, reportQueries } from './reports.js';
import { currentStaff, requireStaff } from './session.js';

// Inicio stays short: a glance at what's next, and the full pending list up to five.
const UPCOMING_SIZE = 3;
const PENDING_SIZE = 5;

// The endpoint takes nothing: the scope comes only from the session, so no parameter can widen it.
const querySchema = z.strictObject({});
const badQuery = { message: 'La consulta del inicio no es válida. Vuelve a cargar la pantalla.' };

// Read only: no document and no audit entry is written here.
export function dashboardRouter(collections: V2Collections) {
  const { staffUsers, volunteers, activities } = collections;
  const queries = reportQueries(collections);
  const router = Router();

  // The first few rows of exactly what the Actividades list shows for the same `when` (and `mine`).
  function section(when: WhenFilter, mine: ObjectId | undefined) {
    const { filter, sort } = activityListFilter(when, undefined, mine);
    const limit = when === 'upcoming' ? UPCOMING_SIZE : PENDING_SIZE;
    return activities.find(filter, { projection: summaryProjection, sort, limit }).toArray();
  }

  router.get('/', requireStaff(staffUsers, 'dashboard.view'), async (request, response) => {
    if (!querySchema.safeParse(request.query).success) {
      response.status(400).json(badQuery);
      return;
    }
    const staff = currentStaff(response);
    const now = new Date();

    if (grantFor(staff.role, 'dashboard.view') === 'all') {
      const [activeVolunteers, month, upcoming, pending] = await Promise.all([
        volunteers.countDocuments({ status: 'active' }),
        queries.summary(currentMonthRange(now)),
        section('upcoming', undefined),
        section('pending', undefined),
      ]);
      response.json({
        scope: 'all',
        kpis: { activeVolunteers, activitiesThisMonth: month.activitiesScheduled, hoursThisMonth: month.totalHours },
        own: null,
        upcoming: upcoming.map(toActivitySummary),
        pending: pending.map(toActivitySummary),
      });
      return;
    }

    const me = staff.id;
    const { year, month, day } = mexicoParts(now);
    const today = `${year}-${month}-${day}`;
    const [todayCount, pendingCount, upcoming, pending] = await Promise.all([
      activities.countDocuments({
        $and: [ownActivities(me), { status: { $in: ['open', 'closed'] }, startsAt: { $gte: mexicoDayStart(today), $lt: mexicoDayStart(addDays(today, 1)) } }],
      }),
      activities.countDocuments(activityListFilter('pending', undefined, me).filter),
      section('upcoming', me),
      section('pending', me),
    ]);
    response.json({
      scope: 'own',
      kpis: null,
      own: { today: todayCount, pending: pendingCount },
      upcoming: upcoming.map(toActivitySummary),
      pending: pending.map(toActivitySummary),
    });
  });

  return router;
}
