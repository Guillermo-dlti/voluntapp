# Scope: Volunt-App

A mobile app for BAMX volunteers to register, browse and sign up for shifts,
check in to activities, and track their hours — with a parallel admin side
for BAMX staff to manage activities, registrations, attendance, and hours.

Build it in a thin, working slice first — one volunteer registering, logging
in, and seeing the home screen — before making any single part fuller. Then
thicken it piece by piece.

## Stack

Expo SDK 57, Expo Router (file-based, `src/app` as root), TypeScript (strict),
React Native 0.86, React 19.2, `NativeTabs` for the bottom tab bar.

Backend: Node.js + TypeScript API in `server/`, MongoDB Atlas (`voluntapp`).
Registration uses email/password; passwords are stored as Argon2id hashes.

**Not yet decided** (real open questions carried over from Stage 1):
- Session method decided: opaque 256-bit bearer tokens, SHA-256 hashes in users.sessions,
  30-day expiry, at most 5 sessions per user; native token storage via Expo SecureStore.
- Notification/reminder system
- Whether volunteers self-enter hours or only BAMX validates them

## Roles

| Role | Can do |
|---|---|
| Volunteer | Register, view shifts, sign up, check in, view own hours/history, edit own profile |
| BAMX Administrator | Create/edit activities, review registrations, validate attendance and hours |
| Technical Administrator | Environment config, database, permissions, backups |

## Data model

| Entity | Key fields | Relationship |
|---|---|---|
| Volunteer | id, name, email, phone, status | has many Registrations, Attendance, Hours |
| Activity/Shift | id, name, description, date, time, location, capacity, status | has many Registrations |
| Registration | id, volunteer, activity, date, status | links Volunteer ↔ Activity |
| Attendance | id, registration, status, check-in time | belongs to a Registration |
| Hours | id, volunteer, activity, amount, validation status | generated from validated Attendance |

The first persisted entity is `users`. A Volunteer is a user with role
`volunteer`; administrators share this collection. Fields: `_id` (ObjectId),
`name`, `username`, `email`, `passwordHash`, `role`, optional `phone`, `status`,
`createdAt`, `updatedAt` (BSON dates). Email and username are trimmed,
lowercased, and each has a unique index. Roles: `volunteer`, `bamx_admin`,
`technical_admin`. Status: `active` or `inactive`. Public registration always
sets `volunteer` and `active`; clients cannot supply role/status/hash/dates.
Passwords are 15–128 characters; usernames are 3–30 ASCII letters, digits,
underscores or periods. Phone, when provided, is an international number
starting with `+` and containing 8–15 digits. No user-list endpoint is public.

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Navigation & app shell | Foundation | done |
| 2 | Coding standards & tooling | Foundation | not started |
| 3 | Backend & data model | Foundation | in progress (users API) |
| 4 | Design & look | Foundation | in progress |
| 5 | Onboarding: Welcome, Login, Sign Up | Slice 1 | registration/login connected |
| 6 | Home Hub | Slice 1 | done (mock) |
| 7 | Oportunidades: list, details, register, confirmation | Slice 1 | done (mock) |
| 8 | Mis Actividades: upcoming/past, cancellation | Slice 2 | done (mock) |
| 9 | Attendance / Check-In | Slice 2 | done (mock) |
| 10 | Mi Impacto (hours, services, kg) | Slice 2 | done (mock) |
| 11 | Perfil: view/edit, logout | Slice 2 | real view/logout; editing pending |
| 12 | Admin module | Slice 3 | not started |

## Foundation

### 1. Navigation & app shell

`src/app` already exists with Expo Router picking it up correctly (confirmed:
"Using src/app as the root directory for Expo Router"). Still the default
template — `index.tsx`/`explore.tsx` and a 2-tab bar need replacing with the
real 5-tab structure (Inicio, Ofertas, Mis Act., Impacto, Perfil) matching the
Figma prototype, plus an auth stack (Welcome → Login/Sign Up) in front of it.

- [x] Confirm Expo Router picks up `src/app`
- [ ] Decide route-group structure (auth stack vs. tabs)
- [ ] Build the tab bar with real 5 tabs
- [ ] Build the auth stack shell (empty screens OK for now)

### 2. Coding standards & tooling

- [ ] Decide on Prettier + ESLint config
- [ ] Add `typecheck`/`format` scripts to `package.json`
- [ ] Decide whether to add a pre-commit hook (Husky + lint-staged) given 4 people committing to one repo

### 3. Backend & data model

- [x] Decide the backend (Node.js/TypeScript API + MongoDB Atlas)
- [x] Decide the auth method (opaque revocable sessions + Expo SecureStore)
- [ ] Implement the Volunteer/Activity/Registration/Attendance/Hours schema
- [ ] Decide whether volunteers self-report hours or only admins validate

Users registration API (implemented).

- [x] Create isolated server package and environment configuration
- [x] Implement users model and unique email/username indexes
- [x] Implement validated registration with Argon2id and fixed volunteer role
- [x] Document startup and manual API verification
- [x] Verify TypeScript and manual HTTP requests
- [x] Verify registration persistence against Atlas
Mobile registration build:

- [x] Add API client with timeout and safe error messages
- [x] Add username, field validation, loading and success states to registration
- [x] Configure public API URL and document emulator startup
- [x] Verify types and registration through the client against Atlas
- [x] Walk the real registration flow in Android (user confirmed persistence in Atlas)

Mobile verification: Expo and server typechecks pass; iOS export succeeds.
The actual client function was exercised against the API and Atlas: successful
registration/persistence, duplicate handling, validation and offline messaging
pass. The temporary account was removed. Registration was subsequently confirmed by the user in Android.

Verification: server build/typecheck and Expo typecheck pass. Manual HTTP
checks with a substituted in-memory collection cover successful registration,
normalization, hash verification/salting, response privacy, duplicate-error
handling, invalid input, forbidden role/status, malformed/oversized JSON,
missing routes and rate limiting. Real Atlas verification also passes: HTTP 201 registration, persisted volunteer
role/status, Argon2id verification, and HTTP 409 for duplicate normalized email
and username. The temporary verification account was removed afterward.
`expo lint` could not complete because ESLint was not configured; its automatic
dependency/config changes were reverted. No test runner was added.

### 4. Design & look

Figma prototype exists (green BAMX branding, per the mockups). Not yet
translated into actual design tokens/theme constants.

- [ ] Pull colors/spacing from Figma into `src/constants/theme.ts`
- [ ] Confirm accessibility baseline (contrast, focus states) per team's own Stage 1 objectives

## Slice 1: Onboarding + core browse/register loop

### 5. Onboarding: Welcome, Login, Sign Up

Registration now submits name, username, email and password to the API and
shows an account-created confirmation. It does not grant a session or open
the tabs. Login now validates credentials and restores a persisted native session.

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

### 6. Home Hub

Summary of next registered activity, featured/available opportunities, nav to
Opportunities/My Activities/Impact/Profile.

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

### 7. Oportunidades: list, details, register, confirmation

List of available shifts → tap for full details (name, description, date,
time, location, requirements, spots) → Register → confirmation screen. On
success, activity appears in Mis Actividades.

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

## Slice 2: Ongoing participation

### 8. Mis Actividades

Upcoming/Pasadas tabs, tap to review details again, cancellation if BAMX
policy allows (before a deadline).

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

### 9. Attendance / Check-In

Per the mockup, this is QR-code based: volunteer opens Check-In on a
registered activity, the app shows a QR code volunteer presents on arrival to
have it scanned. Confirming attendance is what eventually generates hours.

- [x] Decide how the QR is generated/validated (needs a backend decision first)
- [x] Build it (hardcoded flow complete)

### 10. Mi Impacto

Total accumulated hours, number of completed activities/services, kg
distributed, contribution history.

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

### 11. Perfil

View/edit permitted personal info, log out.

- [x] Decide the approach
- [x] Build it (hardcoded flow complete)

## Slice 3: Admin side

### 12. Admin module

Per the Technical/Admin Manual: create/edit/publish activities without
deleting history on cancellation; view registrations and process
cancellations without exceeding capacity; confirm attendance and
validate/record hours; view (not download/share) volunteer info.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

- Production deployment, password recovery and persistent web sessions (local setup is in `server/README.md`)
- Push notifications / reminders (open question, not committed to for MVP)
- Admin backups/maintenance tooling beyond what the chosen backend provides out of the box

Android connectivity follow-up: emulator-5554 is now available. Backend
health and Metro status both pass. ADB reverse for ports 3000 and 8081
was configured and Expo Go reopened through exp://127.0.0.1:8081; the
welcome screen rendered. The user subsequently confirmed registration in Atlas.

## Current build: login and personal profile

Sessions are embedded in `users` (no new collection): `tokenHash`, `createdAt`,
`expiresAt`. Only the random raw token goes to the client. Every protected
request checks expiry and active user status; logout removes the session.
Profile responses explicitly select public account fields.

- [x] Implement rate-limited login by username/email, current-user and logout endpoints
- [x] Persist native session securely, restore on launch and handle expired/offline sessions
- [x] Protect the tabs and connect login/registration success navigation
- [x] Show real account fields in Profile and real name on Home
- [x] Verify API isolation, expiry, revocation, invalid login and existing registration
- [x] Verify Android login, profile, restart persistence and logout

Login verification: server build and both typechecks pass. Manual API checks
against Atlas pass for registration, email/username login, wrong credentials,
invalid payload, own-profile isolation, safe response fields, hashed tokens,
expiry, inactive accounts, logout revocation and five-session cap. Android
Expo Go walkthrough passes: login, real profile/name, process restart with
SecureStore restoration, logout back to welcome, and protected profile deep
link after logout. Confirmed session deletion in Atlas; temporary accounts
were removed. Production transport requires HTTPS. No test runner added.

## Current build: automated login flow with Maestro

Flows live in `.maestro/`, one file per acceptance criterion, named
`<caso>_<resultado>.yaml`. Maestro drives the real app against the real API —
no mocks, no test runner, no extra framework. Credentials come in through
`-e TEST_EMAIL` / `-e TEST_PASSWORD`; the repository never holds real ones.
Flows select elements by `testID`, never by coordinates, so copy changes don't
break them.

- [x] Add stable `testID`s to the login path: welcome button, both login
      fields, submit button, Home container and greeting
- [x] Write `.maestro/login_success.yaml` (clean state → welcome → login →
      credentials → Home assertion) with waits instead of fixed sleeps
- [x] Document the required `.env` keys, including the Android emulator API URL
- [ ] Run the flow on the emulator against the real backend (blocked until
      `npm install` and a root `.env` exist in this checkout)
