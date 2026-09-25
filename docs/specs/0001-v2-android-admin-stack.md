# 0001. Keep the Expo Android app and Express + MongoDB API for the v2 admin app

**Date**: 2026-09-25
**Status**: Accepted

## Summary

v2 turns Volunt-App into an app for BAMX staff instead of volunteers, but the delivery stays the same: an Android app built with Expo, talking to our own Express API, storing data in MongoDB Atlas. We reuse the stack, the server, the login security, and the design, and we replace the volunteer screens with admin screens. Staff sessions stay as a random token kept in the phone's secure storage (the Android Keystore), because cookies are a browser feature and this is a native app.

## Context

After stakeholder feedback, BAMX staff (admin, coordinator, supervisor) became the primary users and volunteers became records with no login. The team has to deliver an Android app, and the v1 app, API, and Atlas database already work end to end: registration, login, hashed session tokens, secure storage on the phone, and a Maestro test on the emulator.

An admin product usually suggests a web dashboard (tables, filters, CSV export), and a reference document for v2 described a Next.js + Supabase web stack. Switching would mean a new framework, a new database, and a new auth system with little time left, and it wouldn't produce the Android app the team has to deliver.

The security course grades authentication, authorization, data protection, and auditability, so whatever stack we keep has to support server-side role checks, validated data, an audit trail, and no secrets on the client.

## Requirements

**User stories**:
- As BAMX staff, I want to manage volunteers, activities, assignments, attendance, and reports from an Android app, so that I can work from the warehouse floor or the activity site.
- As the team, we want to reuse what already works, so that the remaining time goes into admin features and security.

**Acceptance criteria**:
- **AC-1**: The staff app is the existing Expo SDK 57 app in `src/`, built and run on Android (`npm run android`).
- **AC-2**: All data lives in MongoDB Atlas (`voluntapp`) and is only reached through the Express API in `server/`; the app never holds the Mongo URI.
- **AC-3**: Every API route checks the staff session and role on the server before touching data.
- **AC-4**: Staff sessions are opaque random tokens: the phone stores the raw token in Expo SecureStore, the server stores only its SHA-256 hash with an expiry, and logout or deactivation revokes it immediately.
- **AC-5**: No v1 code is deleted. v1 screens that the admin app replaces are moved out of `src/app` (only after the team approves the move), and the last v1 commit is tagged.

## Options considered

### Option 1: Same stack, admin screens (Expo Android + Express + MongoDB)

Keep everything; replace the volunteer screens with admin screens and extend the API.

**Pros**:
- Delivers the Android app the team has to ship.
- Reuses the working server, login security, Atlas setup, fonts, and the Maestro test setup.
- The team already knows every piece.

**Cons**:
- Tables with many columns, and CSV export, are harder on a phone than on a desktop browser; screens have to be designed as searchable lists and cards.
- Browser `httpOnly` cookies don't apply to a native app, so the session design has to be justified as the mobile equivalent.

### Option 2: Next.js + Supabase web app

The stack from the v2 reference document: Postgres with row level security, Supabase Auth, a web dashboard.

**Pros**:
- Strong database-level security (row level security, triggers) and a mature web table ecosystem.

**Cons**:
- Not an Android app, so it misses the delivery requirement.
- Throws away the working API, auth, and database; new framework, database, and hosting for the whole team.

### Option 3: Expo app plus a separate web dashboard

Keep the Android app and also build a web dashboard for the table-heavy work.

**Pros**:
- Best tool for each job.

**Cons**:
- Two frontends to build and secure with a four-person team and a fixed deadline.

## Decision

**Chosen option**: Option 1: Same stack, admin screens.

The v2 admin app is the existing Expo SDK 57 Android app, backed by the existing Express + TypeScript API and MongoDB Atlas.

## Rationale

The delivery requirement (an Android app) and the time left settle it. Everything the security course grades can be done on this stack: argon2id hashing and hashed, revocable session tokens already exist; role checks become middleware on every Express route; MongoDB gives `$jsonSchema` validators, unique indexes, and multi-document transactions for the capacity rule; an insert-only `audit_log` collection is written by the API.

On sessions: the security goal behind "`httpOnly` cookies" is that scripts can't read the token. In a native app there's no browser and no cross-site scripting surface; the equivalent is Expo SecureStore, which encrypts the token with the Android Keystore and keeps it private to the app. The server never stores the raw token, so a database leak doesn't expose live sessions. We keep the design v1 already verified, applied to staff.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript, strict | Already in use on both sides |
| App | Expo SDK 57, Expo Router, `NativeTabs`, Android | Delivery target; existing code |
| API | Node.js + Express 5, zod, helmet, express-rate-limit | Existing `server/`; validation and hardening already in place |
| Primary DB | MongoDB Atlas (`voluntapp`), official `mongodb` driver | Existing cluster; validators, unique indexes, transactions |
| Auth | Hand-implemented: argon2id passwords, opaque 256-bit session tokens hashed with SHA-256, stored in SecureStore on the device | Existing, verified design; required to be hand-implemented |
| Hosting | Local API for the demo; HTTPS required before any public exposure | Out of scope for now (see `scope.md`) |
| Observability | Server logs with IDs and actions only, no personal data | Security rule |

## Build plan

1. Tag the last v1 commit (`v1`), satisfies **AC-5**
2. Move v1 volunteer screens out of `src/app` after the team approves, satisfies **AC-5**
3. Staff session and role middleware on the API, satisfies **AC-3**, **AC-4**
4. Admin tab structure in `src/app` on Android, satisfies **AC-1**
5. All data access through the API with the URI only in the server `.env`, satisfies **AC-2**

The detailed checklists live in `scope.md`, features 0 to 8.

## Consequences

- Admin screens are designed for a phone: searchable lists, cards, detail screens, and short forms instead of wide tables.
- CSV export is generated by the API (role checked and audit logged) and handed to Android's share sheet; that needs a file and sharing library, decided in feature 6.
- Business rules live in the API (Mongo has no triggers like Postgres), so every write path has to go through shared service functions, never ad hoc queries in route handlers.
- The v1 `users` collection and public registration endpoint stay in place but are unused by v2; feature 1 decides whether to switch registration off.

## Follow-up

- Feature 8 needs automated tests where each role tries forbidden actions; pick the tool there (Node's built-in `node:test` for the API avoids a new dependency; Maestro already covers the Android flow).
- `docs/project-context.md`, referenced in the pivot brief, doesn't exist. The product rules from the v2 reference document are folded into `AGENTS.md` and `scope.md` instead.
