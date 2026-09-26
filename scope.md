# Scope: Volunt-App v2

An Android admin app for BAMX staff (admin, coordinator, supervisor). Staff
manage volunteers, activities and shifts, assignments, attendance, hours,
history, and reports. Volunteers are records, not accounts. Same stack as v1
(Expo SDK 57 + Express + MongoDB Atlas, see
`docs/specs/0001-v2-android-admin-stack.md`). Security rules, permissions,
data model, and business rules live in `AGENTS.md`.

Build approach: a thin working slice first (staff logs in on Android and sees
one real screen backed by Atlas), then thicken one feature at a time, in the
order below.

## MVP demo flow

The one path the MVP has to walk end to end:

1. Staff logs in
2. Dashboard
3. Creates a volunteer
4. Creates an activity
5. Assigns volunteers
6. Records attendance and hours
7. Finalizes
8. The volunteer's history and total hours update
9. Exports a report (CSV)

## At a glance

| # | Feature | Status |
|---|---|---|
| 0 | Stack decision + foundation | done |
| 1 | Staff auth & roles | done (spec 0002) |
| 2 | Volunteers | not started |
| 3 | Activities & assignments | not started |
| 4 | Attendance & hours | not started |
| 5 | Dashboard | not started |
| 6 | Reports + CSV export | not started |
| 7 | Staff management + audit log viewer | not started |
| 8 | Hardening | not started |

## 0. Stack decision + foundation

Same app, same stack; lay the ground every later feature stands on.

- [x] Decide the stack: same Expo Android app + Express + MongoDB (spec 0001)
- [x] Tag the last v1 commit `v1` (local tag; push it with `git push origin v1`)
- [x] Replace the v1 volunteer screens in `src/app` with the admin tabs (v1 kept under the tag)
- [x] Restore a committed `.env.example` (names only) and remove it from `.gitignore`
- [x] Server: one startup step that creates every v2 collection with its `$jsonSchema` validator and indexes (`server/src/collections.ts`)
- [x] Server: shared audit log writer (insert only, strips `passwordHash`/`sessions`) and a logger that drops personal data keys (`server/src/audit.ts`, `server/src/logger.ts`)
- [x] Server: `permissions.ts` with the role table from `AGENTS.md`
- [x] App: admin tab shell (Inicio, Voluntarios, Actividades, Reportes, Ajustes) with placeholder screens
- [x] Design tokens: Figma green palette plus status colors in `src/constants/theme.ts`; Outfit/Geist fonts
- [x] Add a root `typecheck` script covering app and server (`npm run typecheck`)
- [x] Verify: typecheck passes; `/health` 200 against Atlas; all six v2 collections exist with validators and indexes; invalid documents are rejected (code 121); the five tabs render on the Android emulator

Notes: the app still logs in with v1 volunteer accounts until feature 1 swaps
in staff auth, so Ajustes shows the v1 role. `audit_log` is insert only in
the API; making it insert only in the database too (an Atlas custom role for
the app's user, without update/remove on `audit_log`) is listed under
Hardening. The unused `audit.ts`/`permissions.ts` get their first callers in
feature 1.

## 1. Staff auth & roles

- [x] Decide what each role may do (permission table in `AGENTS.md`, first draft)
- [x] Seed script for local staff accounts (`npm run server:seed`), password from `SEED_STAFF_PASSWORD` in `.env`, never from source
- [x] Staff login / logout / me endpoints: argon2id, hashed opaque tokens, 12 h sessions, max five, rate limited login, logins/logouts audit logged (`server/src/auth.ts`)
- [x] Middleware `requireStaff()`: active staff session plus a capability on every route; inactive accounts count as signed out (`server/src/session.ts`)
- [x] Switch off v1's public `POST /api/auth/register` (now 404); welcome and sign-up screens removed
- [x] App: staff login screen, SecureStore session, Reportes hidden from supervisors, admin section of Ajustes only for admins
- [x] UI polish: palette from the BAMX logo, shared Button/grouped list/EmptyState/Screen/Icon components, dashboard header with date and greeting (rules in `AGENTS.md` → Design)
- [x] Verify: 18 API checks against Atlas pass (each role logs in; wrong/unknown/inactive → same 401; no session → 401; supervisor → reports capability 403; 12 h expiry; five-session cap; logout revokes; audit entries without hashes; register 404); on the emulator the old v1 session is rejected, supervisor sees 4 tabs, admin sees 5 tabs and the admin section, logout returns to login

Revoking sessions when an admin deactivates someone is part of feature 7
(staff management); until then an inactive account is already refused on its
next request.

## 2. Volunteers

- [ ] Create and edit volunteers (validated in the UI and on the server)
- [ ] List with search (name, email, phone) and filter (status)
- [ ] Deactivate and reactivate (no delete)
- [ ] Detail page: activity history plus total hours derived from finalized attendance
- [ ] Every change written to `audit_log`

## 3. Activities & assignments

- [ ] Create and edit activities; status changes draft → open → closed, or cancelled
- [ ] Assign volunteers, only to `open` activities and only if the volunteer is `active`
- [ ] Capacity enforced atomically (transaction or conditional update), with no race condition
- [ ] Block overlapping assignments for the same volunteer
- [ ] Cancel an assignment (no delete)
- [ ] Every change written to `audit_log`

## 4. Attendance & hours

- [ ] Mark present / absent / late with check-in and check-out times
- [ ] Enter hours, never more than the activity's duration
- [ ] Finalize an activity's attendance
- [ ] Admin only correction of finalized attendance, written to `audit_log`
- [ ] Totals always derived from finalized attendance

## 5. Dashboard

- [ ] KPIs (active volunteers, activities this month, hours this month; exact list confirmed when this feature starts)
- [ ] Upcoming activities
- [ ] Activities pending attendance finalization

## 6. Reports + CSV export

- [ ] Hours per volunteer, attendance per activity, participation by date range
- [ ] CSV export generated on the server, respecting the caller's role, and written to `audit_log`
- [ ] Android: download the CSV and open the share sheet (pick the file/sharing library here)
- [ ] Guard against CSV formula injection (cells starting with `=`, `+`, `-`, `@`)

## 7. Staff management + audit log viewer

- [ ] Admin creates, edits, deactivates staff and changes roles
- [ ] Audit log viewer (admin only), filterable by actor, collection, and date

## 8. Hardening

- [ ] Pick a test tool for the API (this reverses v1's "no test runner" choice); Maestro stays for the Android MVP flow
- [ ] Maestro flow for the whole MVP demo flow
- [ ] Seed ~30 volunteers and 8 activities with realistic Guadalajara/Zapopan data (past, current, future; some finalized) for the demo
- [ ] Tests where each role tries every forbidden action and gets 401/403
- [ ] Tests for the business rules: capacity race, overlap, assigning a closed activity or an inactive volunteer, hours over the duration, a non-admin editing finalized attendance
- [ ] Check that no endpoint hard deletes and none returns `passwordHash`
- [ ] Review the logs for personal data
- [ ] Atlas custom role for the API's database user: no `update`/`remove` on `audit_log`, no `dropCollection` (makes insert only true in the database, not just the API)

## v1 code (kept, not deleted)

v1 was the same Expo SDK 57 app aimed at volunteers. None of it is deleted.

**Reusable in v2**

- The app itself: Expo Router setup, `NativeTabs` shell, dev build config,
  fonts (Outfit headings, Geist body), `src/components` (`form-field`,
  `back-button`, themed text/view), and the Android + Maestro setup.
- Session handling on the device: `src/services/session-storage.ts`
  (SecureStore), `src/providers/auth-provider.tsx` (restore on launch,
  revalidate on resume), `src/services/auth.ts` (API client with timeout and
  safe error messages). They switch from volunteer `users` to `staff_users`.
- `server/` foundation: Express 5 + helmet + `no-store` + JSON size limit +
  rate limiting + zod + argon2id, the Atlas connection
  (`server/src/database.ts`), environment validation (`server/src/config.ts`),
  and the plain Spanish error handler. Its login logic (dummy hash against
  timing leaks, hashed tokens, max five sessions) is the base for staff auth.
- Brand colors: the greens and neutrals hardcoded across the screens.
  `src/constants/theme.ts` is still the Expo template, so the tokens still
  have to be pulled out.
- `.maestro/login_success.yaml`: the pattern for v2 flows.

**v1 only (parked)**

- Volunteer screens in `src/app`: welcome, sign-up, and the tabs Ofertas,
  Mis Actividades (with QR check-in), Impacto, plus the volunteer Inicio and
  Perfil, with `mock-data.ts` and the QR component. Replaced by the admin
  tabs in feature 0; the code lives on under the git tag `v1`.
- Public volunteer self-registration `POST /api/auth/register` and the
  `users` collection with the `volunteer` role. Volunteers don't log in in
  v2, so feature 1 decides whether to switch the endpoint off.

## Future / backlog (v1 volunteer features)

Not in the v2 MVP. Kept here so the ideas aren't lost.

- Volunteer self sign-up (built in v1, see above)
- Volunteers browsing and signing up for shifts (mock in v1)
- QR check-in (mock in v1)
- Notifications and reminders (never built)
- Volunteer impact screen: hours, services, kg distributed (mock in v1)
- Volunteer profile editing, password recovery

## Not doing right now

- Production deployment (HTTPS is required before anything is exposed publicly)
- Backups and maintenance tooling beyond what Atlas provides
