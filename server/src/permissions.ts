import type { StaffRole } from './collections.js';

// Single source of truth for who may do what (mirrors the table in AGENTS.md). BAMX may still
// change it, so routes ask `can()` instead of comparing roles inline.
export type Capability =
  | 'staff.manage'
  | 'volunteers.read'
  | 'volunteers.write'
  | 'activities.read'
  | 'activities.write'
  | 'assignments.write'
  | 'attendance.record'
  | 'attendance.finalize'
  | 'attendance.correctFinalized'
  | 'reports.view'
  | 'audit.view';

// 'own' means allowed only on activities where the staff member is the supervisorId;
// the route has to check that ownership against the activity itself.
export type Grant = 'all' | 'own' | 'none';

const permissions: Record<Capability, Record<StaffRole, Grant>> = {
  'staff.manage': { admin: 'all', coordinator: 'none', supervisor: 'none' },
  'volunteers.read': { admin: 'all', coordinator: 'all', supervisor: 'all' },
  'volunteers.write': { admin: 'all', coordinator: 'all', supervisor: 'none' },
  'activities.read': { admin: 'all', coordinator: 'all', supervisor: 'all' },
  'activities.write': { admin: 'all', coordinator: 'all', supervisor: 'none' },
  'assignments.write': { admin: 'all', coordinator: 'all', supervisor: 'none' },
  'attendance.record': { admin: 'all', coordinator: 'all', supervisor: 'own' },
  'attendance.finalize': { admin: 'all', coordinator: 'all', supervisor: 'own' },
  'attendance.correctFinalized': { admin: 'all', coordinator: 'none', supervisor: 'none' },
  'reports.view': { admin: 'all', coordinator: 'all', supervisor: 'none' },
  'audit.view': { admin: 'all', coordinator: 'none', supervisor: 'none' },
};

export function grantFor(role: StaffRole, capability: Capability): Grant {
  return permissions[capability][role];
}

// True when the role may use the capability at all (fully or on its own activities).
export function can(role: StaffRole, capability: Capability): boolean {
  return grantFor(role, capability) !== 'none';
}

// Full check for activity-scoped capabilities once the activity's supervisorId is known.
export function canOnActivity(
  role: StaffRole,
  capability: Capability,
  staffId: string,
  supervisorId: string | undefined,
): boolean {
  const grant = grantFor(role, capability);
  return grant === 'all' || (grant === 'own' && supervisorId !== undefined && supervisorId === staffId);
}
