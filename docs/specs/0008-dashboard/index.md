# 0008. Role aware dashboard on Inicio

**Date**: 2026-10-14
**Status**: In Progress

## Summary

Inicio is still a placeholder. This spec turns it into the first screen staff use every day: three numbers for the month, the next three activities, and the activities whose attendance still needs to be finalized. Admins and coordinators see the whole organization. Supervisors see only the activities they supervise, with two counts (today, and waiting to be finalized) and no organization wide numbers, because they can't see Reportes. Everything comes from one new read only endpoint, `GET /api/dashboard`, which scopes the data by role on the server and reuses the counting rules from Reportes and the activities list, so the dashboard never disagrees with them. The Actividades list also gains a "Solo mis actividades" filter, so a supervisor's "Ver todas" opens the same activities the dashboard showed.

## Requirements

**User stories**:
- As a coordinator or admin, I want to see this month's hours, active volunteers, and scheduled activities when I open the app, so that I know how the month is going without opening Reportes.
- As a coordinator or admin, I want the next activities and the ones still waiting to be finalized on the first screen, so that I know what needs me today.
- As a supervisor, I want to see only the activities I run, how many are today, and which ones I still have to finalize, so that I'm not distracted by the rest of the organization.

**Acceptance criteria**:
- **AC-1**: For admin and coordinator, Inicio keeps today's header (date eyebrow, greeting, role chip) and shows three KPI cards (`StatCard`) at the top: "Horas este mes" full width (value a bare number such as "12.5", caption "horas finalizadas"), then "Voluntarios activos" (caption "en el padrón") and "Actividades este mes" (caption "publicadas o cerradas") side by side. Counts use `es-MX` integer formatting (`toLocaleString('es-MX')`); hours use the number part of Reportes' formatting (up to 2 decimals, `es-MX`).
- **AC-2**: The KPI values are, with "this month" meaning the current calendar month in Guadalajara time (`America/Mexico_City`):
  - **Voluntarios activos**: volunteers with `status = active`.
  - **Actividades este mes**: activities with `status` open or closed whose `startsAt` falls in this month (the same rule Reportes uses for its range; drafts and cancelled excluded).
  - **Horas este mes**: exactly Reportes' `totalHours` for "Este mes" (finalized records of finalized activities starting this month), shown with the same hours formatting as Reportes.
  None of them is stored; each is computed on every request.
- **AC-3**: Each KPI card is pressable (`PressableScale`, Spanish accessibility label such as "Ver horas de este mes en Reportes"). Because tabs stay mounted and keep their filters, every link sets the target filter explicitly and lands on the tab's root list: "Horas este mes" opens Reportes with `preset=thisMonth`; "Voluntarios activos" opens Voluntarios with `status=active`; "Actividades este mes" opens Actividades with `when=upcoming`. The target always shows that filter, even if the user had picked another one earlier and even on a second tap of the same link (see *Route params*).
- **AC-4**: A "Próximas actividades" section lists up to 3 activities (changed from 5 on 2026-10-14 after the first review: Inicio is a glance, "Ver todas" has the rest) chosen by the same rule as the Actividades "Próximas" chip (`when=upcoming`: draft or open, not yet ended, soonest first). Each row shows the name, the schedule, the status badge, and the hint from `listHint()`, like the Actividades list. Tapping a row opens the activity detail. A "Ver todas" row opens Actividades on "Próximas". When empty, an `EmptyState` says what will appear there and why it is empty.
- **AC-5**: A "Por finalizar" section lists up to 5 activities chosen by the same rule as the "Por finalizar" chip (`when=pending`: open or closed, already started, attendance not finalized, oldest first), with the same row layout. Tapping a row opens the activity detail (which opens on Asistencia through `defaultTab()`). A "Ver todas" row opens Actividades on "Por finalizar". When empty, the section shows one row "Nada pendiente" plus the footer "Las horas de un voluntario solo cuentan cuando su asistencia está finalizada."
- **AC-6**: For a supervisor, Inicio shows no organization wide KPIs. Instead, two cards side by side: "Hoy" (caption "actividades tuyas"; their activities, open or closed, whose `startsAt` falls on today in Guadalajara, so drafts and cancelled ones don't count; display only, not pressable, accessibility label "Hoy tienes N actividades") and "Por finalizar" (caption "asistencia pendiente"; the total count of their pending activities, not capped at 5; pressing it opens Actividades with `when=pending&mine=true`). Both lists contain only activities where they are the `supervisorId`, and "Próximas actividades" excludes drafts. Their "Ver todas" rows open Actividades with "Solo mis actividades" on. A supervisor with no activities of their own sees the empty states, never someone else's activities.
- **AC-7**: `GET /api/dashboard` requires a session (401 without one) and the new `dashboard.view` capability (admin all, coordinator all, supervisor own). The server decides the scope from the session's role through `grantFor()`; for an `own` grant the response carries `kpis: null` and only the caller's activities. Nothing in the request can widen the scope.
- **AC-8**: `GET /api/activities` accepts `mine=true`, which narrows any `when` and `q` to activities where `supervisorId` is the caller and `status` is not draft. In the Actividades tab, supervisors see a "Solo mis actividades" toggle chip on its own row in the band, under the `when` chips, on by default (testID `activities-mine`, accessibility role switch with the selected state). Turning it off shows every activity (they may read all) and stays off until the app is restarted or a dashboard link sets it again. While it is on, each empty state adds the line "Solo ves las actividades que supervisas. Quita el filtro para ver todas." Admins and coordinators don't see the chip, and their Actividades ignores a `mine` param.
- **AC-9**: Inicio reloads every time the tab gains focus and on pull to refresh (`Screen` `refreshing`/`onRefresh`). Once data is on screen, a focus reload is silent (no loading state, the old data stays until the new answer arrives). Only the newest request may update the screen, so a slow earlier response can't overwrite a newer one.
- **AC-10**: While the first load runs (no data yet), Inicio shows a loading state under the header. If the first load fails, it shows an `EmptyState` with a plain Spanish sentence and a "Reintentar" button. If a later reload fails, it keeps the last data and shows the note "No se pudo actualizar. Desliza hacia abajo para intentarlo de nuevo." A 401 calls `refresh()` from `useAuth()` (sign out), like every other screen.
- **AC-12** (added 2026-10-14 after the first review, refined the same day): KPI cards follow Apple Health: white card, small green icon and label, near black number with a small gray unit ("59.5 horas"); the supervisor's "Por finalizar" label turns mango only when it is above 0. Numbers in side by side cards sit on one line. Activity rows (Inicio and Actividades) start with a neutral date tile showing the Guadalajara start day; the month is green while ahead, mango when attendance waits, gray once finalized or cancelled. Inicio's blocks fade in on first load (`Motion.enter`, `Motion.stagger`).
- **AC-11**: All copy is Spanish and plain, numbers use `es-MX` formatting, the screen uses only theme tokens and shared components (`AGENTS.md` → Design). Section titles are "Próximas actividades" and "Por finalizar"; "Ver todas" is a `Row` with a chevron. testIDs: `home-kpi-hours`, `home-kpi-volunteers`, `home-kpi-activities`, `home-own-today`, `home-own-pending`, `home-upcoming`, `home-pending`, `home-upcoming-all`, `home-pending-all`, rows `home-activity-<id>`, `home-stale-note`. The endpoint is read only: it writes no audit entry, and its log lines carry no personal data. An unknown query parameter gets 400 `{ message: 'La consulta del inicio no es válida. Vuelve a cargar la pantalla.' }`.

## Decision

**Chosen option**: Option 1: one role scoped dashboard endpoint that reuses the existing counting and list rules.

Add `GET /api/dashboard` in a new `server/src/dashboard.ts`, guarded by a new `dashboard.view` capability. It returns the month KPIs (admin and coordinator) or the supervisor's two counts, plus the next 3 upcoming and the first 5 pending activities, built from the same functions that serve `GET /api/activities` and `GET /api/reports/summary`. Add `mine=true` to the activities list and a "Solo mis actividades" chip for supervisors. Rebuild `src/app/(tabs)/index.tsx` on the shared components. No schema change.

Small calls made here (pick, why, runner up):
- **Shared list rule.** `listQuery()` in `server/src/activities.ts` becomes an exported `activityListFilter(when, q, mine?: ObjectId): { filter: Filter<Activity>; sort }` and the row mapper becomes an exported `toActivitySummary()`. With `mine`, the result is `{ $and: [whenFilter, ...wordFilters, { supervisorId: mine, status: { $ne: 'draft' } }] }` (the `when=all` filter `{}` composes the same way). The list route and the dashboard both call them. Why: the "Ver todas" list and the dashboard section can't drift apart. Runner up: copying the filters into `dashboard.ts`.
- **Shared counting rule.** `server/src/reports.ts` exports the `Range` type, `reportQueries`, `inRange`, and a new `currentMonthRange(now)` that builds the same `Range` the "Este mes" preset sends: from `mexicoParts(now)` take `year`, `month`; `from = YYYY-MM-01`; `nextFirst` = the 1st of the next month (December rolls to January of `year + 1`); `to = addDays(nextFirst, -1)`; `start = mexicoDayStart(from)`; `end = mexicoDayStart(nextFirst)`. `summary()` gains an `activitiesScheduled` field (`candidates.length`, which it already loads), and the dashboard takes `hoursThisMonth = totalHours` and `activitiesThisMonth = activitiesScheduled` from one `summary(range)` call. Why: the hours KPI is guaranteed to equal Reportes "Este mes", with no second query. Runner up: a separate aggregate in `dashboard.ts`.
- **Supervisor "own" filter.** `{ supervisorId: <caller>, status: { $ne: 'draft' } }`, combined with `$and` onto the `when` filter. Used by the dashboard for an `own` grant and by `mine=true` for anyone. Why: one definition of "my activities", and a draft isn't confirmed yet, so it doesn't belong on a supervisor's plan. Runner up: including drafts (they would then appear in "Ver todas" but not on the dashboard, or the other way round).
- **Pending count for supervisors** is a separate `countDocuments` with the same filter, so "Por finalizar" shows the real total even when the list shows 5.
- **Today's range**: `today = \`${year}-${month}-${day}\`` from `mexicoParts(now)`; `[mexicoDayStart(today), mexicoDayStart(addDays(today, 1)))`, all from `server/src/common.ts`.
- **Queries run in parallel** (`Promise.all`); no transaction, since it is a read and a few milliseconds of skew between counts is harmless.
- **No new index.** Activities are in the hundreds; `activities_status_starts` already serves the status plus date filters. Revisit only if a measured query is slow (Follow-up).
- **Route params.** One encoding everywhere: `when=<WhenFilter>`, `mine=true` (left out when off), `status=active`, `preset=thisMonth`. KPI cards and "Ver todas" call `router.navigate()` to the tab's root list (`/actividades`, `/voluntarios`, `/reportes`) with those params, which pops any detail screen open in that tab's stack. Each target screen (Actividades, Voluntarios, Reportes) reads its params in `useFocusEffect`, applies them to its filter state, then clears them with `router.setParams({ ... : undefined })`, so a second tap of the same link applies again and a later manual chip change is never overridden. Unknown values are ignored. Runner up: a nonce param keyed in an effect.
- **Rows** push `/actividades/<id>`. Back from that detail returns to the Actividades list, not Inicio (the detail lives in the Actividades stack). Accepted for this feature; checked on the emulator.
- **Layout branch.** The screen renders from the response's `scope` (`'all'` → KPIs, `'own'` → supervisor cards), not from `user.role`, so the server alone decides what appears. `src/constants/roles.ts` gets nothing new for the dashboard. In the response, `own` is `null` when `scope` is `'all'` and `kpis` is `null` when `scope` is `'own'`; the app guard rejects any other combination as an unexpected answer.
- **Chip state** for "Solo mis actividades" is screen state in Actividades (initial value `true` for supervisors), not persisted.
- **Response validation.** `src/services/dashboard.ts` checks the response shape with type guards, like `src/services/activities.ts`, reusing its `isSummary` guard (exported), and throws the same "respuesta inesperada" `ApiError` when it doesn't match.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:
No change. The dashboard reads existing collections:

| Collection | Fields read | Used for |
|---|---|---|
| `volunteers` | `status` | Voluntarios activos |
| `activities` | `status`, `startsAt`, `endsAt`, `attendanceFinalizedAt`, `supervisorId`, plus the list projection (`name`, `location`, `capacity`, `assignedCount`) | Actividades este mes, Hoy, both lists, counts |
| `assignments`, `attendance` | through `countedRecords()` in `reports.ts` | Horas este mes |

**State transitions**: none. The dashboard displays the existing activity steps through `activityStep()` and `listHint()`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/dashboard` | GET | none (strict: any query param is a 400) | `scope: 'all' \| 'own'`; `kpis: { activeVolunteers, activitiesThisMonth, hoursThisMonth } \| null`; `own: { today, pending } \| null`; `upcoming: ActivitySummary[]` (≤ 3); `pending: ActivitySummary[]` (≤ 5) | session + `dashboard.view` | 401 no session, 403 no grant, 400 unknown param |
| `/api/activities` | GET | adds `mine`: `'true'` (opt) to the existing `when`, `q`, `page` | unchanged | session + `activities.read` (unchanged) | 400 invalid `mine` (existing list message) |

`ActivitySummary` is the existing list row (`id`, `name`, `location`, `startsAt`, `endsAt`, `capacity`, `assignedCount`, `status`, `attendanceFinalizedAt`), produced by `toActivitySummary()`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| GET dashboard | `scope` | `grantFor(staff.role, 'dashboard.view')`: `all` → `'all'`, `own` → `'own'` |
| GET dashboard | "this month" range | `currentMonthRange(new Date())`: first to last calendar day of the current month from `mexicoParts(now)`, `start`/`end` via `mexicoDayStart()` |
| GET dashboard | `kpis.activeVolunteers` | `volunteers.countDocuments({ status: 'active' })` |
| GET dashboard | `kpis.activitiesThisMonth` | `reportQueries(collections).summary(monthRange).activitiesScheduled` (new field: `candidates.length`, i.e. `inRange(monthRange)`) |
| GET dashboard | `kpis.hoursThisMonth` | the same `summary(monthRange)` call, `.totalHours` (already rounded to 2 decimals) |
| GET dashboard | `own.today` | `activities.countDocuments({ supervisorId: me, status: { $in: ['open','closed'] }, startsAt: { $gte: todayStart, $lt: tomorrowStart } })` |
| GET dashboard | `own.pending` | `activities.countDocuments(activityListFilter('pending', undefined, me).filter)` |
| GET dashboard | `upcoming` | `activityListFilter('upcoming', undefined, own ? me : undefined)`, its sort, `limit 5` |
| GET dashboard | `pending` | `activityListFilter('pending', undefined, own ? me : undefined)`, its sort, `limit 5` |
| GET dashboard | `me` | `currentStaff(response).id` (an `ObjectId`) from the session |
| GET dashboard | today range | `mexicoParts(now)` → `today`; `mexicoDayStart(today)`, `mexicoDayStart(addDays(today, 1))` |
| GET activities | `mine` narrowing | query param `mine=true` → caller's `_id` from the session |
| Inicio | row hint, step | `listHint(activity)` / `activityStep()` in `src/utils/activity-flow.ts` |
| Inicio | schedule text | `formatSchedule(startsAt, endsAt)` in `src/utils/time.ts` |
| Inicio | hours text | `formatHours()` in `src/utils/report-range.ts` (same as Reportes) |
| Inicio | header date, greeting | `todayLabel()`, `greeting()`, `firstName()` (unchanged) |
| Inicio | layout branch | `scope` from the response |
| Inicio | KPI number text | counts: `value.toLocaleString('es-MX')`; hours: the number part of `formatHours()` |
| Actividades, Voluntarios, Reportes | initial filter after a dashboard link | route params `when`/`mine`, `status`, `preset` |

**Key invariants**:
- `kpis.hoursThisMonth` equals Reportes "Este mes" `totalHours` at the same moment (same function).
- The dashboard's upcoming and pending sets are the first 3 and the first 5 of what the Actividades list returns for the same `when` (and `mine`, for supervisors).
- For an `own` grant, every returned activity has `supervisorId` equal to the caller and `status` not draft; `kpis` is null.
- Nothing is written: no document, no audit entry.

**Security model**:
- `dashboard.view`: admin `all`, coordinator `all`, supervisor `own`, in `server/src/permissions.ts` (and the table in `AGENTS.md`). Checked by `requireStaff(staffUsers, 'dashboard.view')`.
- Scope comes only from the session role; the endpoint takes no parameters, so a supervisor can't ask for organization data.
- The KPIs are organization wide aggregates, which is why they are withheld from supervisors, in line with `reports.view` being denied to them.
- `mine=true` only narrows a list the caller may already read (`activities.read`), so it needs no new check.
- The supervisor's narrow view is a focus choice, not an isolation control: supervisors may read every activity and volunteer through other endpoints. What the scope does protect is the organization wide KPIs, which follow the `reports.view` rule. Hardening tests should check "no KPIs for supervisors", not "supervisors can't see other activities".
- Logs: route errors go through `log` with IDs and actions only; no names in log lines.

**Critical test scenarios**:
- Happy path: coordinator opens Inicio, sees the three KPIs (hours equal Reportes "Este mes"), 3 upcoming and the pending list; taps a pending row and lands on its Asistencia tab, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**
- Supervisor scope: a supervisor with one own pending activity and other people's activities in the database sees only theirs, "Por finalizar" 1, no KPIs; "Ver todas" shows the same set in Actividades with the chip on, verifies **AC-6**, **AC-8**
- Auth/permission: no token → 401; supervisor response has `kpis: null` and no foreign `supervisorId`; any query parameter → 400, verifies **AC-7**
- Failure case: load once, go offline, pull to refresh → last data stays with the note; first launch offline → EmptyState with Reintentar, verifies **AC-10**
- Month edge: a finalized activity starting on the 1st at 00:30 Guadalajara counts this month; one on the last day of the previous month at 23:30 doesn't, verifies **AC-2**

## Build plan

Build approach: Tracer Bullet (the project's default in `scope.md`): one thin thread from permission to screen first, then thicken.

1. Add `dashboard.view` to `server/src/permissions.ts` (admin all, coordinator all, supervisor own), satisfies **AC-7**
2. Refactor `server/src/activities.ts`: export `activityListFilter(when, q, mine?)` (adds the own filter) and `toActivitySummary()`; the list route uses them, behavior unchanged without `mine`, satisfies **AC-4**, **AC-5**
3. In `server/src/reports.ts`: export the `Range` type, `reportQueries`, `inRange`, and the new `currentMonthRange()`; add `activitiesScheduled` to `summary()`, satisfies **AC-2**
4. New `server/src/dashboard.ts` with `GET /api/dashboard` (strict empty query, scope from `grantFor`, parallel queries), mounted at `/api/dashboard` in `server/src/app.ts`, satisfies **AC-2**, **AC-6**, **AC-7**, **AC-11**
5. New `src/services/dashboard.ts` (`getDashboard()` through `apiRequest()`, shape guards, exported `isSummary` from `src/services/activities.ts`), satisfies **AC-1**
6. Rebuild `src/app/(tabs)/index.tsx` for admin and coordinator: KPI cards, "Próximas actividades", "Por finalizar", rows with schedule, badge and hint, row taps to the detail, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**
7. KPI card and "Ver todas" navigation with explicit params; Actividades (`when`, `mine`), Voluntarios (`status`) and Reportes (`preset`) apply route params on focus and clear them, satisfies **AC-3**, **AC-4**, **AC-5**
8. Supervisor layout ("Hoy" and "Por finalizar" cards, own lists, links with `mine`), satisfies **AC-6**
9. `mine=true` on `GET /api/activities` (zod `z.literal('true').optional()`), `listActivities({ mine })` in the app service (param left out when false), and the "Solo mis actividades" toggle chip for supervisors, on by default, with the extra empty state line, satisfies **AC-8**
10. Focus reload, pull to refresh, newest request wins, loading, first load error with Reintentar, keep last data with the note, 401 sign out, satisfies **AC-9**, **AC-10**
11. Verify: API checks against Atlas (each role's response shape, supervisor scope with foreign activities present, 401, 400 on a query param, hours equal `/api/reports/summary` for this month, `mine` on the list), then on the Android emulator as coordinator, supervisor and admin, satisfies **AC-1** to **AC-11**

## Consequences

**Positive**:
- The first screen answers "how is the month going" and "what needs me" for every role.
- Dashboard, Actividades and Reportes share their rules in code, so their numbers and lists can't disagree.
- Supervisors get a focused view of their own work, and the "Solo mis actividades" chip helps them in Actividades too.

**Negative / tradeoffs**:
- One more capability in the permission map and one more route to keep in the Hardening role tests.
- Each Inicio focus runs about six queries, including the hours aggregate. Fine at BAMX's volume; it would need caching only at a scale BAMX doesn't have.
- `reports.ts` and `activities.ts` now export internals that another module depends on, so changes to them affect the dashboard too (that's the point, but it couples them).
- Actividades, Voluntarios and Reportes gain route params, so their filter state can now be set from outside; params are applied on focus and then cleared, so they never override a chip the user taps later.
- Back from an activity opened on Inicio returns to the Actividades list, not Inicio.

**Neutral**:
- The supervisor definition of "my activities" (own and not draft) is new and also changes what supervisors see first in Actividades (the chip is on by default).
- `AGENTS.md` permission table gains a "View dashboard" row (`/sync` will add it).

## Follow-up

- [ ] Add `dashboard.view` to the permission table in `AGENTS.md` and the dashboard notes under "Auth and route checks" (owned by `/sync` after the build).
- [ ] Feature 8 (Hardening): include `GET /api/dashboard` in the role tests (supervisor never gets KPIs or foreign activities).
- [ ] If a dashboard query is ever measured slow, add an index on `activities { supervisorId: 1, startsAt: 1 }`.
- [ ] Open from spec 0005: schedule edits after attendance exists. Not in this feature.
