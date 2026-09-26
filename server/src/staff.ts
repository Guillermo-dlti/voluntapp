import { Router } from 'express';
import type { V2Collections } from './collections.js';
import { requireStaff } from './session.js';

export function staffRouter(collections: V2Collections) {
  const { staffUsers } = collections;
  const router = Router();

  // The supervisor picker on the activity form. Only the people who can write activities need it.
  router.get('/supervisors', requireStaff(staffUsers, 'activities.write'), async (_request, response) => {
    const supervisors = await staffUsers.find({ active: true, role: 'supervisor' }, {
      projection: { fullName: 1 },
      sort: { fullName: 1, _id: 1 },
      collation: { locale: 'es', strength: 1 },
    }).toArray();
    response.json({ supervisors: supervisors.map((staff) => ({ id: staff._id.toHexString(), fullName: staff.fullName })) });
  });

  return router;
}
