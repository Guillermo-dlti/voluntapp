import type { StaffRole } from '@/services/auth';

export const roleLabels: Record<StaffRole, string> = {
  admin: 'Administración',
  coordinator: 'Coordinación',
  supervisor: 'Supervisión',
};

// Mirrors server/src/permissions.ts only to hide what a role can't use. The API is the real
// check: showing something here never grants access, and hiding it never replaces the server check.
export const roleCan = {
  editVolunteers: (role: StaffRole) => role !== 'supervisor',
  editActivities: (role: StaffRole) => role !== 'supervisor',
  assignVolunteers: (role: StaffRole) => role !== 'supervisor',
  // Supervisors record and finalize only on activities they supervise (the API's canOnActivity).
  recordAttendance: (role: StaffRole, supervisorId: string | null, userId: string) => role !== 'supervisor' || supervisorId === userId,
  correctAttendance: (role: StaffRole) => role === 'admin',
  viewReports: (role: StaffRole) => role !== 'supervisor',
  manageStaff: (role: StaffRole) => role === 'admin',
  viewAudit: (role: StaffRole) => role === 'admin',
} as const;
