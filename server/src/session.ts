import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Collection, ObjectId } from 'mongodb';
import type { StaffRole, StaffUser } from './collections.js';
import { can, type Capability } from './permissions.js';

export const SESSION_HOURS = 12;

export interface AuthenticatedStaff {
  id: ObjectId;
  role: StaffRole;
  tokenHash: string;
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.authorization ?? '');
  return match?.[1]?.toLowerCase() ?? null;
}

// Public profile only; explicit fields so passwordHash and sessions can never leak through a spread.
export function publicStaff(staff: StaffUser) {
  return {
    id: staff._id.toHexString(),
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    active: staff.active,
  };
}

// Finds the account behind a token. Inactive accounts and expired sessions count as signed out,
// so deactivating someone takes effect on their very next request.
export async function findSessionStaff(staffUsers: Collection<StaffUser>, token: string) {
  const hash = tokenHash(token);
  const staff = await staffUsers.findOne({
    active: true,
    sessions: { $elemMatch: { tokenHash: hash, expiresAt: { $gt: new Date() } } },
  });
  return staff ? { staff, hash } : null;
}

const signedOut = { message: 'Tu sesión terminó. Inicia sesión de nuevo.' };
const forbidden = { message: 'Tu rol no tiene permiso para hacer esto.' };

// Every protected route uses this: 401 without a valid session, 403 when the role lacks the capability.
// Activity-scoped grants ('own') pass here and must be narrowed by the route with canOnActivity().
export function requireStaff(staffUsers: Collection<StaffUser>, capability?: Capability): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const token = bearerToken(request);
    const found = token ? await findSessionStaff(staffUsers, token) : null;
    if (!found) {
      response.status(401).json(signedOut);
      return;
    }
    if (capability && !can(found.staff.role, capability)) {
      response.status(403).json(forbidden);
      return;
    }
    response.locals.staff = { id: found.staff._id, role: found.staff.role, tokenHash: found.hash } satisfies AuthenticatedStaff;
    next();
  };
}

export function currentStaff(response: Response): AuthenticatedStaff {
  const staff: unknown = response.locals.staff;
  if (typeof staff !== 'object' || staff === null || !('id' in staff) || !('role' in staff) || !('tokenHash' in staff)) {
    throw new Error('requireStaff must run before this handler.');
  }
  return staff as AuthenticatedStaff;
}
