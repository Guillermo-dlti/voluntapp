# 0008. Role aware dashboard on Inicio: rationale

## Context

This is feature 5 of `scope.md` and step 2 of the MVP demo flow (staff logs in, then sees the dashboard). Inicio has shown a placeholder since feature 1: a greeting, an empty "Próximas actividades" state, and a fixed "Nada pendiente" row. Features 3 to 6 and the 5a rework have since built everything the dashboard would summarize: activities with a computed step (`src/utils/activity-flow.ts`), the `when=upcoming` and `when=pending` list rules, and the Reportes counting rule (`countedRecords()` in `server/src/reports.ts`, finalized records of finalized activities only).

The forces are the same as in earlier features. Security is graded, so every endpoint checks the session and a capability from the one permission map, and the app hiding something is never the protection. Supervisors are denied `reports.view`: organization wide numbers and exports stay with admins and coordinators (least privilege). Supervisors can still read every activity and volunteer, and their real work is the activities where they are the `supervisorId`. Totals are never stored; they are computed from finalized attendance.

The main risk is disagreement. If the dashboard counted hours or chose "pending" activities with its own query, a coordinator would see one number on Inicio and another on Reportes, or a pending activity on Inicio that the "Por finalizar" chip doesn't list. Spec 0007 created `activity-flow.ts` and `when=pending` precisely so the dashboard could share them.

Without this feature, staff open the app on an empty screen and have to visit three tabs to learn what needs them today. The MVP demo also starts here.

## Options considered

### Option 1: One role scoped dashboard endpoint reusing the existing rules

A new `GET /api/dashboard` returns the KPIs (or the supervisor's counts) plus the first 5 upcoming and pending activities, already scoped by role on the server. It calls the same filter and counting functions as the activities list and Reportes, exported for reuse.

**Pros**:
- One request per load, one place where the scope is decided, on the server.
- Same functions as the list and Reportes, so the numbers match by construction.
- The permission is one new capability that BAMX can change in one line.

**Cons**:
- A new route and capability to maintain and test.
- Couples `dashboard.ts` to internals of `reports.ts` and `activities.ts`.

### Option 2: Compose from existing endpoints plus a small KPI endpoint

The app calls `GET /api/activities?when=upcoming` and `?when=pending` (with a new `mine` filter for supervisors) and a new `GET /api/dashboard/kpis`.

**Pros**:
- Reuses endpoints as they are; the KPI endpoint stays tiny.
- Lists are paginated already.

**Cons**:
- Three requests per load, each able to fail separately, so partial screens need handling.
- The supervisor scope depends on the app sending `mine=true`; forgetting it shows a supervisor everyone's activities (allowed by `activities.read`, but not what the spec wants).
- Fetches 50 rows to show 5.

### Option 3: Reuse Reportes' summary as the KPI source with `reports.view`

Use `GET /api/reports/summary` for this month's numbers and the list endpoints for the rest, with no new capability. Supervisors get the lists only.

**Pros**:
- No new endpoint for numbers and no new capability.

**Cons**:
- `summary` doesn't return active volunteers or the scheduled activity count, so it would grow fields that Reportes doesn't need.
- The dashboard rule ends up split across two capabilities, which is harder to explain and to change.
- Still has the multiple requests and the client side scoping problem of Option 2.

## Rationale

Option 1 fits the two forces that matter most here. The scope has to be decided on the server (graded security, and the supervisor's view must not depend on the app remembering a flag), and the dashboard must never disagree with Reportes or the Actividades list. A single endpoint that derives the scope from the session and calls the very same filter and counting functions satisfies both: there is no request a supervisor could send to get organization numbers, and there is no second copy of a rule to drift.

The cost is a new capability and some exported internals. The capability is the honest way to record the rule ("everyone has a dashboard, supervisors only for their own activities") in the one permission map, using the `own` grant that already exists for attendance. The coupling is deliberate: it is what keeps the numbers equal.

The engineer chose (in this conversation): supervisors see only their own activities, with "Hoy" and "Por finalizar" counts and no KPIs; the three scope KPIs for admin and coordinator, with "this month" as the Guadalajara calendar month and activities counted as open or closed starting this month; next 5 upcoming and up to 5 pending, each with "Ver todas"; pressable KPI cards; reload on focus and pull to refresh; one dashboard endpoint; a new `dashboard.view` capability; no drafts in the supervisor's upcoming list; a "Solo mis actividades" chip on by default for supervisors; keeping the last data with a note when a reload fails; and the hours card full width above the other two.
