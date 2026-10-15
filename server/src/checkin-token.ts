import { randomBytes } from 'node:crypto';

// A volunteer's check in token: 24 random bytes (192 bits) in base64url, the only thing their QR holds.
// It is a pointer, not a credential: it does nothing without a staff session that may record attendance.
export const CHECKIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function newCheckinToken(): string {
  return randomBytes(24).toString('base64url');
}
