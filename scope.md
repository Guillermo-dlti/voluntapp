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
| 2 | Volunteers | done (spec 0003) |
| 3 | Activities & assignments | done (spec 0004) |
| 4 | Attendance & hours | done (spec 0005) |
| 5a | Activity, attendance and reports UX rework | in-progress (spec 0007) |
| 5 | Dashboard | in-progress (spec 0008) |
| 6 | Reports + CSV export | done (spec 0006) |
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

Spec: [`docs/specs/0003-volunteers.md`](docs/specs/0003-volunteers.md) (plan and decisions approved 2026-09-25). Branch: `feature/volunteers`.

**Design pass first** (approved 2026-09-25: keep our own components, add depth,
modeled on Shopify's admin and its `light-mobile` Polaris theme: flat bordered
controls, depth on cards and raised elements only, fast ease-out motion).

- [x] Tokens: `Elevation` (card, raised), `Motion`, avatar tones in `theme.ts`
- [x] `Screen` gets the forest header band on every tab (title, optional action and band content), body as a sheet over it
- [x] Grouped lists and empty states sit on an elevated card surface
- [x] New shared components: `PressableScale`, `Card`, `Avatar`, `StatusBadge`, `FilterChips`, `SearchField`, `Fab`, `StatCard`; `Button` gets secondary/critical variants and an icon
- [x] Existing tabs (Inicio, Voluntarios, Actividades, Reportes, Ajustes) moved onto the new pieces
- [x] `AGENTS.md` → Design updated (soft shadows on raised elements)
- [x] Verify: typecheck passes; Inicio, Actividades, Ajustes checked on the Android emulator (band, sheet, card shadows, avatar). Search, chips, badge, FAB and stat card get their first real use in the Volunteers screens

**Volunteers**

- [x] Shared app request helper `src/services/api.ts` (auth client moved onto it)
- [x] API `server/src/volunteers.ts`: list/search, create, edit, status, detail with history and totals; writes and their audit entry in one transaction
- [x] Create and edit volunteers (validated in the UI and on the server)
- [x] List with search (name, email, phone; accent-insensitive, every word must match) and filter (status)
- [x] Deactivate and reactivate (no delete), with a confirmation before deactivating
- [x] Detail page: activity history plus total hours and completed activities derived from finalized attendance
- [x] Every change written to `audit_log`
- [x] Verify: 31 API checks against Atlas pass (every AC in spec 0003; test records removed afterwards). On the emulator: supervisor sees the list read only with no "Nuevo" button; coordinator creates (with field errors first), picks a birth date, views detail, deactivates, reactivates, edits, and finds the record by searching

Notes: the date picker is the native Material one from `@expo/ui`; it only keeps a
date after "Usar fecha", because it reports its starting date as soon as it opens.
Its labels follow the phone's language (English on the emulator, Spanish on a
phone set to es-MX). Detail also returns `completedActivities` (finalized present
or late), which AGENTS.md lists as a computed value.

## 3. Activities & assignments

Spec: [`docs/specs/0004-activities-assignments.md`](docs/specs/0004-activities-assignments.md) (decisions approved 2026-09-25). Branch: `feature/activities`.

- [x] Design it (spec)
- [x] Build it: `/develop` activities & assignments (code in `server/src/activities.ts`, `server/src/staff.ts`, `src/app/(tabs)/actividades/`)
  - [x] Schema changes (`assignedCount`, `assignmentLock`, cancel fields, validator, index, capacity max 1000), live in Atlas (AC-1, AC-7)
  - [x] Create and list activities, API and app (AC-1, AC-2, AC-12)
  - [x] Detail, status changes draft/open/closed/cancelled, edit, supervisor picker (AC-3, AC-4, AC-13, AC-14)
  - [x] Assign and cancel assignments: capacity counter, volunteer lock, overlap, reactivation; Participantes and Asignar screens (AC-5, AC-6, AC-8, AC-9, AC-11)
  - [x] Date edit overlap check naming who is affected (AC-10)
- [x] Verify it: API checks for every AC against Atlas (including parallel requests for capacity and overlap), then the flow on the Android emulator as coordinator and supervisor
  - [x] 69 API checks against Atlas pass (every AC; 10 parallel assigns into capacity 3 give exactly 3; one volunteer into two overlapping activities in parallel gives exactly one; same pair and reactivation in parallel give one success and one 409, never a 500; `assignedCount` equals a recount on every test activity; no `assignmentLock` in any audit snapshot). Test records removed afterwards
  - [x] Walk the flow on the Android emulator. As coordinator: field errors on an empty form; create (draft, Guadalajara time, supervisor); publish; search and assign two volunteers to a 2 place activity (picker marks "Ya asignado", count 2/2, "Cupo lleno"); cancel one with a reason (short reason refused), reassign (same record); overlap refusal naming the other activity; back to back allowed; a date edit refused naming the affected person. As supervisor: 4 tabs, list and detail read only (no create, edit, status, assign or cancel). Walk records removed afterwards
- [x] Every change written to `audit_log` (checked in the API checks)

Notes: the walk found the inline Compose pickers squashing in a half width column and making the
form jump to the bottom when they opened or closed. `DateField` (also used by volunteers) and the new
`TimeField` now open the native Material dialogs instead, with Spanish "Usar fecha"/"Usar hora" and
"Cancelar" buttons; they only report a value on confirm, so the earlier "Usar fecha" workaround is gone.
The calendar's own header still follows the phone's language. The form works in Guadalajara wall
clock time (the spec said the device zone; same thing on BAMX phones, worth one line in spec 0004).
An end time at or before the start means the activity ends the next day.

## 4. Attendance & hours

Spec: [`docs/specs/0005-attendance-hours.md`](docs/specs/0005-attendance-hours.md) (decisions approved 2026-09-25, cross checked). Branch: `feature/attendance`. Next after this: feature 6 (Reports), since every report number comes from finalized attendance.

- [x] Design it (spec)
- [x] Build it: `/develop` attendance & hours. Code in `server/src/attendance.ts`, `src/app/(tabs)/actividades/[id]/` (Asistencia section, `asistencia/[assignmentId].tsx`), `src/utils/attendance-rules.ts`
  - [x] Schema fields and the record endpoint with the Asistencia section and record form on the phone (AC-1, AC-2, AC-3, AC-9)
  - [x] Mark all present and finalize, closing the activity (AC-4, AC-5)
  - [x] Admin correction with reason; assignment cancel blocked once attendance exists (AC-6, AC-7)
  - [x] Supervisor own activity checks in the API and the app (AC-10)
- [x] Verify it: API checks for every AC against Atlas (parallel requests for AC-8), then the flow on the Android emulator as coordinator, supervisor and admin (AC-1 to AC-10)
  - [x] 67 API checks against Atlas (reported by the implementer), including three rounds of the four AC-8 races; temporary API test records and their audit entries were removed.
  - [x] Android emulator: coordinator saw unrecorded rows, missing-name refusal, mark all, late with times, local field errors, attendance-based cancellation refusal, absent, finalization and closed/read-only state. Admin correction required a reason, showed "corregido", and changed a volunteer total from 1 to 0.5 hours. Supervisor had actions on their own open activity and a read-only row with no buttons on another. Future, draft and cancelled activity messages rendered. Showcase records were left in Atlas at the user's request.
- [x] Every change written to `audit_log` (checked against Atlas: insert per record, update per finalize and correction, no lock fields in snapshots)
- [x] Totals always derived from finalized attendance (volunteer detail shows the hours after finalizing, and again after a correction)

Follow-up decision for `/architect`: changing an open activity's schedule after attendance exists can make its recorded times or hours invalid. Spec 0005 does not define this edit rule. One option is to refuse schedule edits once any attendance record exists.

Showcase data left in Atlas: "Clasificación de alimentos · asistencia" is closed with finalized present, late and absent rows plus an admin correction. "Preparación de despensas · asistencia" is open with three unrecorded people for the recording demo; its supervisor is Daniela Ruiz. "Registro de donaciones · coordinación" is open with one unrecorded person and no supervisor for the read-only supervisor view. All three ran 25 September, 6:00–9:00 p.m.; after that window they appear under Pasadas.

## 5a. Activity, attendance and reports UX rework

Spec: [`docs/specs/0007-activity-attendance-reports-ux/index.md`](docs/specs/0007-activity-attendance-reports-ux/index.md) (decisions approved 2026-10-13). Branch: `feature/activity-ux`. Code in `src/utils/activity-flow.ts`, `src/app/(tabs)/actividades/`, `src/app/(tabs)/reportes/index.tsx`, `src/providers/auth-provider.tsx`, `server/src/activities.ts`, `server/src/reports.ts`, `src/components/bar-chart.tsx`, `src/hooks/use-report-export.ts`. Staff found running an activity and downloading reports hard to follow; this reorganizes the screens without changing any business rule. Built before the dashboard, which links into these screens.

- [x] Design it (spec)
- [x] Build it: `/develop` activity UX rework
  - [x] Flow module `src/utils/activity-flow.ts` and shared `SegmentedTabs`, `ActionSheet`, `IconButton`, `Screen` footer (AC-1, AC-2, AC-3, AC-8, AC-13)
  - [x] Activity detail: progress strip, next step card, "⋯" menu, tabs; Participantes tab with call and cancel (AC-1 to AC-4, AC-9)
  - [x] Asistencia tab as a one tap roll call with the fixed finalize bar (AC-5 to AC-9)
  - [x] Activities list hint and "Por finalizar" filter (`when=pending`) (AC-10)
  - [x] Offline session check fix (AC-12)
  - [x] Reportes summary (top 5 by hours, attendance split, summary API counts) and one "Descargar reporte completo (CSV)" card with a file picker sheet, replacing the per report cards (AC-11, AC-11b; spec updated 2026-10-13)
- [ ] Verify it: `/check verify` on the Android emulator as coordinator, supervisor and admin

## 5. Dashboard

Spec: [`docs/specs/0008-dashboard/index.md`](docs/specs/0008-dashboard/index.md) (decisions approved 2026-10-14, cross checked). Branch: `feature/dashboard`. Admin and coordinator see three KPIs for the Guadalajara calendar month (horas, voluntarios activos, actividades), the next 3 activities and up to 5 por finalizar (Reportes dropped its stat cards for a totals line; Apple Health style KPI cards and date tiles, AC-12). Supervisors see only activities they supervise, with "Hoy" and "Por finalizar" counts and no KPIs. Code in `server/src/dashboard.ts`, `server/src/activities.ts` (`activityListFilter`, `toActivitySummary`), `server/src/reports.ts` (`currentMonthRange`), `src/app/(tabs)/index.tsx`, `src/services/dashboard.ts`, `src/components/activity-row.tsx`, `src/components/toggle-chip.tsx`.

- [x] Design it (spec)
- [x] Build it: `/develop` dashboard
  - [x] Server: `dashboard.view` capability, shared `activityListFilter`/`toActivitySummary` and `currentMonthRange`, `GET /api/dashboard` (AC-2, AC-6, AC-7, AC-11)
  - [x] Inicio for admin and coordinator: KPI cards, Próximas actividades, Por finalizar (AC-1, AC-2, AC-4, AC-5)
  - [x] Links with explicit route params into Actividades, Voluntarios and Reportes (AC-3)
  - [x] Supervisor layout, `mine=true` on the activities list and the "Solo mis actividades" chip (AC-6, AC-8)
  - [x] Focus reload, pull to refresh, loading, error and stale states (AC-9, AC-10)
- [ ] Verify it: `/check verify` dashboard on the Android emulator as coordinator, supervisor and admin, plus API checks against Atlas

## 5b. UI polish

Branch: `feature/ui-polish`. UI only: no API, auth or schema change, no new dependency (Reanimated 4 does all of it; Skia was left out because it costs ~3 MB of CanvasKit on web for one optional background). Keeps the layout, colors and screens; makes the app feel intentional through one set of motion tokens, skeletons, and fit and finish. Verified on the Android emulator and on Expo web.

- [x] Motion foundation: one duration, curve and spring in `Motion` (`theme.ts`), `src/utils/motion.ts` helpers that fall back to a plain fade under Reduce Motion, `PressableScale` springs back and every tappable row uses it
- [x] `Skeleton` with shimmer and shaped placeholders replacing every loading spinner card (Inicio, Voluntarios, Actividades, details, Reportes, forms)
- [x] `RollingNumber` digit by digit in `StatCard`
- [x] Confetti burst in BAMX greens when attendance is finalized, nowhere else
- [x] Toasts that slide in for saved / finalized / status changes (`FeedbackProvider`)
- [x] Splash in forest with the BAMX logo, held until fonts load, no Expo overlay (needs a rebuild: `npm run android`)
- [x] Large text (font scale 2) pass on every main screen; magic numbers on touched screens moved to tokens
- [x] Login ambient background, paused under Reduce Motion and in the background
- [x] Verify on the Android emulator: normal and font scale 2, animations removed (Reduce Motion), skeletons and rolling digits (slowed down to capture), toast and confetti (temporarily hooked to pull to refresh; finalizing would have changed Atlas data), splash after a rebuild
- [ ] Verify on web: blocked. `localhost:8081` answers 500 (`addCustomSourceTransformer` of undefined in static rendering), already the case on `main`; `expo install --check` lists outdated Expo packages (`expo-router` 57.0.17, expected ~57.0.27), the likely cause
- [ ] Known limit: the NativeTabs bar labels truncate at font scale 2 (native Android tab bar, not styleable from React)

Design review against Mobbin references (Shopify, Apple Health, Luma, Flighty, WhatsApp, Teams), approved and built in groups. Before and after screenshots are on the review page.

- [x] Tokens: `Type` scale and `Spacing` (with `gutter`) in `theme.ts`, every screen and shared component on them; unused Expo template files removed (`themed-*`, `use-theme`, `use-color-scheme`, `ui/collapsible`, `web-badge`, `external-link`, `hint-row`)
- [x] Activity detail: one primary action (the next step card keeps only its sentence on Asistencia, and its "Asignar voluntarios" replaces the tab's own button), neutral `SegmentedTabs` thumb, `ProgressBar` for capacity instead of the lone 6/10 card, band pill from `stepBadge()`
- [x] Detail rows show a small label over a prominent value (`Row` `emphasis="value"`): Detalles, volunteer detail, Ajustes
- [x] Activity rows in four lines instead of five: time only (the tile has the day), place, step pill with one fact (`listHint()` now returns how full it is, never both "6/10" and "faltan 4"). Tried three lines (time and place together); the place got cut too short
- [x] Roll call: one joined Presente/Tarde/Falta control, no duplicate pill while recording, counts in the filter chips, progress bar, outlined Finalizar until everyone is recorded
- [x] Alignment: one 20 dp gutter for band and sheet, dividers start at the text (`Section` `inset`), chips scroll to the screen edge, field labels inset like section titles
- [x] Inicio: quiet outlined role pill, chevron on tappable `StatCard`s (`linked`), "Ver todas" as a link row
- [x] Reportes: hours as the headline number, export as a secondary button, short range ("1–31 oct 2026"), "Ver detalle" above export
- [x] Forms: white inputs with a 1 px border, "Ej.:" placeholders, `FieldGroup` without a card, date and time as `PickerRow`s in one card
- [x] Empty and error states: `EmptyState` `action` (Reintentar inside) and `bare`, shorter copy
- [x] Small fixes: counts in list section headers (loaded count, "+" while more pages exist; the API has no totals), plain participant icon buttons, no duplicate email in Ajustes, dimmed "Próximamente" rows, show/hide password
- [x] Collapsing band: the large title folds into a compact one as the content scrolls and snaps open or folded; only on pages long enough to scroll; stays put under Reduce Motion
- [x] Verify on the Android emulator: Inicio, Voluntarios, Actividades, activity detail (three tabs), roll call, Reportes, Ajustes, new activity form, login. Typecheck (app and server) passes; lint has the same 12 errors as `main` (setState in effect, refs during render), none new. Font scale 2 skipped at the user's call

## 5c. Start attendance manually

Branch: `feature/ui-polish` (built there at the user's request, after 5b). An "Iniciar asistencia" button lets staff who may record attendance on an activity open it before the start time. `POST /api/activities/:id/attendance/start` (`attendance.record`, own activity for supervisors) stamps `attendanceStartedAt`/`attendanceStartedBy` on an open or closed activity that hasn't started, with its audit entry in the same transaction. Recording, mark all, finalize, "Por finalizar" and the reports' pending count accept either the start time passed or `attendanceStartedAt` set (`attendanceOpened()` in `server/src/activities.ts`). Check in and check out times still have to fall inside the activity's schedule.

- [x] Server: fields and validator, `attendanceOpened()`, start endpoint with refusal messages, summary and detail expose `attendanceStartedAt`
- [x] App: `activityStep()` treats a started activity as Asistencia; next step card offers "Iniciar asistencia" when assigning isn't the next thing; the Asistencia tab offers it always (with a confirmation), then switches to the roll call with a toast
- [x] Verify: button and copy on the Android emulator; API refusals checked (401 no session, 404 bad id, 409 already open, 403 another supervisor's activity). Not run: an actual start, which would stamp a shared demo activity in Atlas for good

## 6. Reports + CSV export

Spec: [`docs/specs/0006-reports-csv-export/index.md`](docs/specs/0006-reports-csv-export/index.md) (decisions approved 2026-10-13, cross checked). Branch: `feature/reports`.

- [x] Design it (spec)
- [x] Build it: `/develop` reports & CSV export. Code in `server/src/reports.ts` (+ `csv.ts`, date helpers in `common.ts`), `src/app/(tabs)/reportes/`, `src/services/reports.ts`. New native modules `expo-file-system` and `expo-sharing`: rebuild the dev build (`npm run android`) after pulling
  - [x] Range validation and summary, API and the Reportes screen with presets and stat cards (AC-1, AC-2, AC-3, AC-10, AC-11)
  - [x] Hours per volunteer: list endpoint, preview and full list screen (AC-4, AC-11)
  - [x] CSV export: writer with injection guard, audit before send, per staff rate limit, download and share on Android (AC-6, AC-7, AC-8, AC-9, AC-12)
  - [x] Attendance per activity: list, CSV, preview and full list screen (AC-5, AC-6, AC-11, AC-12)
- [x] Verify it: `/check verify` 2026-10-13, 22 of 33 steps passed against Atlas and the emulator (see `verify.md`). Marked done with one known issue (fix planned in 5a, AC-12): "Descargar" offline returns to the full screen "No hay conexión" because the foreground session refresh fails (`src/providers/auth-provider.tsx`), so the message under the button never shows. Not run (need writes to Atlas or hands on work): range edges, pending count, inactive volunteer with hours, paging past 50, the 429 limit, the server log line, Excel, Drive/Gmail delivery, sign out on a server side 401

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
