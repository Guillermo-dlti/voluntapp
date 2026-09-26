# 0002. Staff authentication and role checks

**Date**: 2026-09-25
**Status**: Accepted

## Summary

BAMX staff sign in to the Android app with their email and password. The server checks the password, hands back a random session token that lasts 12 hours, and from then on checks that token and the person's role on every request. Volunteer self registration from v1 is switched off, because volunteers no longer have accounts.

## Requirements

**User stories**:
- As a staff member, I want to sign in with my email and password so that I can use the app for my shift.
- As an admin, I want every request checked on the server so that a coordinator or supervisor can't do more than their role allows, whatever the app shows.

**Acceptance criteria**:
- **AC-1**: `POST /api/auth/login` with a correct email and password for an active staff account returns a token, its expiry, and the public staff profile (`id`, `fullName`, `email`, `role`, `active`); never `passwordHash` or sessions.
- **AC-2**: A wrong email, a wrong password, or an inactive account all return 401 with the same message. Login is rate limited (20 attempts per 15 minutes per IP).
- **AC-3**: Sessions expire 12 hours after login. At most five live sessions per account; a sixth login drops the oldest.
- **AC-4**: Every protected route goes through one middleware: no or expired token → 401; an inactive account → 401; a role without the required capability (`server/src/permissions.ts`) → 403.
- **AC-5**: `POST /api/auth/logout` revokes that token only. Successful logins and logouts are written to `audit_log`.
- **AC-6**: `POST /api/auth/register` no longer exists (404). The app has no welcome or sign-up screen; it opens on staff login.
- **AC-7**: A seed script creates `admin@bamx.test`, `coordinador@bamx.test`, `supervisor@bamx.test` when missing, with the password from `SEED_STAFF_PASSWORD` in `.env` (15+ characters). It never overwrites an existing account.
- **AC-8**: The app shows the staff role, hides the Reportes tab from supervisors, and shows the admin section of Ajustes only to admins.

## Decision

Reuse v1's verified session design, pointed at `staff_users`:

- Passwords: argon2id (memory 19 MiB, time 2, parallelism 1), a dummy hash check for unknown emails so response time doesn't reveal which emails exist.
- Tokens: 256 random bits, hex encoded; only the SHA-256 hash is stored in `staff_users.sessions` with `createdAt`/`expiresAt`. The app keeps the raw token in Expo SecureStore (see spec 0001).
- Lifetime: 12 hours, down from v1's 30 days, because staff can see volunteers' personal data and a lost phone shouldn't stay signed in for a month. Approved by the team on 2026-09-25.
- Registration: removed (approved 2026-09-25). v1's code is under the `v1` tag.
- `audit_log.action` gains `login` and `logout`.

## Feature design

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/auth/login | POST | email (req), password (req) | token, expiresAt, staff | none | 400, 401, 429 |
| /api/auth/me | GET | | staff | bearer | 401 |
| /api/auth/logout | POST | | 204 | bearer (optional) | |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| login | token | `crypto.randomBytes(32)` |
| login | expiresAt | server time + 12 h |
| login/me | staff profile | `staff_users` document, public fields only |
| any protected route | staff + role | session lookup by token hash, `active: true`, `expiresAt > now` |
| any protected route | allowed? | `can(role, capability)` from `permissions.ts` |
| app tabs | visible tabs | staff role from `/me`, mirrored rule in `src/constants/permissions.ts` |

**Security model**: see `AGENTS.md` → Security and Roles. The app's role check only hides UI; the API decides.

**Configuration required**:
- `SEED_STAFF_PASSWORD`: local only password for the three seed accounts. Never used outside local development.

**Critical test scenarios**:
- Happy path: each seed account signs in and sees its tabs, verifies **AC-1**, **AC-8**
- Failure: wrong password and inactive account get the same 401, verifies **AC-2**
- Permission: a supervisor token calling a coordinator-only route gets 403, verifies **AC-4**

## Build plan

1. Staff auth routes and session middleware on `staff_users`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
2. Remove registration and the v1 `users` code path, satisfies **AC-6**
3. Seed script, satisfies **AC-7**
4. App: staff login, role-aware tabs and Ajustes, remove welcome/sign-up, satisfies **AC-6**, **AC-8**
5. Verify each acceptance criterion against Atlas and on the emulator

## Consequences

- Staff sign in again each workday.
- The v1 `users` collection is no longer read or written; its data stays in Atlas until the team decides.
- Staff management (create, deactivate, change role) is feature 7; until then accounts come from the seed script.
