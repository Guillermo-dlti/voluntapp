# 0004. Activities and assignments: schedule, publish, assign, cancel

**Date**: 2026-09-25
**Status**: In Progress

## Summary

Staff create activities (a shift or event with a place, a start and end time, and a capacity), publish them, and assign volunteers to them one at a time. The API guarantees that an activity never goes over capacity and that nobody is booked into two activities at the same time, even when two staff members tap "Asignar" at the same moment. Nothing is deleted: activities and assignments are cancelled, and every change goes to the audit log. Attendance (feature 4) builds on the assignments made here.

## Context

This is feature 3 of `scope.md` and step 4 and 5 of the MVP demo flow (create an activity, assign volunteers). It stands on spec 0002 (staff sessions, `requireStaff`, the permission map) and spec 0003 (volunteer records, the transaction plus audit pattern, the shared app request helper). The `activities` and `assignments` collections, their validators, and the unique `(volunteerId, activityId)` index already exist from feature 0; no documents exist in them yet.

Two business rules from `AGENTS.md` are concurrency problems, not just validation: capacity must hold "with no race condition", and a volunteer can't be assigned to two activities that overlap in time. A simple "count, then insert" check lets two coordinators assigning at the same moment both pass the check and overbook the activity, or double book one volunteer. MongoDB has no row locks or triggers, so the guarantee has to come from atomic conditional updates and transactions that are designed to collide.

The rest is lifecycle: which status changes are legal, what can be edited once people are assigned, and what happens to assignments when an activity is cancelled (rule 8: they are kept). Security is graded: every route checks the session and capability on the server, supervisors are read only here, and every write is audit logged with its change in the same transaction.

Constraints: BAMX scale is small (hundreds of activities a year, capacities in the tens), staff use Android phones, dates are shown in `es-MX`, `America/Mexico_City`, and stored as UTC BSON dates.

## Requirements

**User stories**:
- As a coordinator, I want to create an activity with its place, time, capacity and supervisor, keep it as a draft, and publish it when it's ready.
- As a coordinator, I want to assign volunteers to an open activity and be told plainly when it's full or the person is busy at that time.
- As a coordinator, I want to cancel an assignment with a reason, or cancel a whole activity, without losing its history.
- As a coordinator, I want to move an activity's date and be warned if that would double book someone already assigned.
- As staff (any role), I want to see upcoming and past activities and who is assigned to each.

**Acceptance criteria**:
- **AC-1**: Admin or coordinator creates an activity with name, location, start, end, capacity (required) and optional description, requirements, supervisor. It is saved with `status: draft`, `assignedCount: 0`, `createdBy` = the staff member, and an `insert` audit entry. Past dates are allowed.
- **AC-2**: Invalid input is rejected with field level Spanish messages, in the app before sending and by the API (400 with `fields`): end not after start, duration over 24 hours, capacity outside 1 to 1000, a `supervisorId` that is not an active staff member with role supervisor, unknown fields.
- **AC-3**: Status changes follow the state machine only: draft → open, open → draft (only while `assignedCount` is 0), open → closed, draft or open → cancelled. Closed and cancelled are final. Any other change returns 409 with a plain message. Each change writes an `update` audit entry.
- **AC-4**: Details (name, description, location, start, end, capacity, requirements, supervisor) can be edited only while the activity is draft or open (else 409). Capacity can't go below the current `assignedCount` (409). Each edit writes an `update` audit entry with before and after.
- **AC-5**: Admin or coordinator assigns an active volunteer to an open activity. The assignment is saved with `status: assigned`, `assignedBy`, the activity's `assignedCount` goes up by one, and an audit entry is written, all in one transaction. Assigning after the activity started or ended is allowed.
- **AC-6**: Assigning is refused with 409 and a plain message when: the activity is not open; the volunteer is inactive; the activity is full; the volunteer is already assigned to it; or the volunteer has another `assigned` assignment on a non cancelled activity that overlaps in time (`A.start < B.end` and `B.start < A.end`; back to back is fine). The overlap message names the other activity and its date.
- **AC-7**: Capacity and overlap hold under concurrency: N parallel assign requests for an activity with K free places produce exactly K assignments; two parallel requests assigning one volunteer to two overlapping activities produce exactly one.
- **AC-8**: Assigning a volunteer whose assignment to that activity was cancelled reactivates the same record (`status: assigned`, new `assignedBy`, cancel fields removed), increments `assignedCount`, and writes an `update` audit entry. No duplicate record is created.
- **AC-9**: Admin or coordinator cancels an assignment of an open activity with a reason (3 to 500 characters). It keeps the record with `status: cancelled`, `cancelledReason`, `cancelledAt`, `cancelledBy`, decrements `assignedCount`, and writes an `update` audit entry, in one transaction.
- **AC-10**: Changing the start or end of an activity that has assigned volunteers is refused with 409 when it would make any of them overlap with another of their assignments. The message and a `conflicts` list name each affected volunteer and the other activity. No partial change is saved.
- **AC-11**: Cancelling an activity keeps its assignments untouched. Cancelled activities never count for overlap checks.
- **AC-12**: The list returns 20 activities per page with a `when` filter: `upcoming` (default: draft or open, not yet ended, soonest first), `past` (closed, or draft or open already ended, newest first), `cancelled` (newest first), `all` (newest first); "newest first" means `startsAt` descending, ties broken by `_id`, plus a search on the name (at least 2 characters, escaped, accent insensitive like volunteers). Each row has name, location, start, end, capacity, assigned count, and status.
- **AC-13**: The detail returns the activity, its supervisor's name (if any), and its participants: assigned first then cancelled, each with the volunteer's name, phone, assignment status and cancel reason.
- **AC-14**: Supervisors can list and view activities and participants but get 403 on every write (create, edit, status, assign, cancel) and on the supervisor list endpoint; the app hides those actions for them. No session returns 401. Invalid ids return 404 with a plain message.

## Options considered

### Option 1: Read, check, then write inside a transaction

Count the assigned assignments and look up the volunteer's other assignments, then insert, all inside a MongoDB transaction, trusting the transaction to keep it consistent.

**Pros**:
- Shortest code, reads like the business rule.
- No extra fields in the data model.

**Cons**:
- MongoDB transactions use snapshot isolation: two transactions that only read the same documents and insert different ones never conflict, so both commit and the activity is overbooked. It fails exactly the rule it is meant to enforce.

### Option 2: Stored counter plus a lock field on the volunteer, inside a transaction (recommended)

The activity keeps `assignedCount`. Assigning runs `updateOne({ _id, status: 'open', assignedCount: { $lt: capacity } }, { $inc: { assignedCount: 1 } })` (with the capacity compared through `$expr`) as the first step of a transaction; zero matches means full or not open. The same transaction writes a fresh ObjectId to the volunteer's `assignmentLock`, then checks overlaps and inserts or reactivates the assignment. Any two transactions touching the same activity or the same volunteer now write the same document, so MongoDB raises a write conflict and the driver's `withTransaction` retries the loser, which then sees the committed state.

**Pros**:
- Capacity is a single atomic condition; correct by construction.
- Overlap is serialized per volunteer with no global lock; unrelated assignments still run in parallel.
- Uses only the driver's built in transaction retry, no new infrastructure.

**Cons**:
- `assignedCount` is a stored derived value that must be kept in step on every assign, reactivate and cancel; a bug there drifts it (mitigated: it only changes inside the same transactions, and a verification check recounts it).
- Adds an internal field to `volunteers` that every projection must hide.

### Option 3: Materialized time slots

Store one document per volunteer per time slot with a unique index, so the database itself rejects double booking.

**Pros**:
- Overlap enforced by a unique index, no application logic.

**Cons**:
- Activities have arbitrary start and end minutes; slots force a fixed grid (15 minutes means 96 documents per volunteer per day) and every date edit rewrites them. Far more moving parts than BAMX's scale needs.

## Decision

**Chosen option**: Option 2: Stored counter plus a lock field on the volunteer, inside a transaction

Activities and assignments are REST routes in `server/src/activities.ts` guarded by `requireStaff`; every assignment write runs in one transaction that increments or decrements `activities.assignedCount` conditionally and stamps `volunteers.assignmentLock`, so capacity and overlap hold under concurrency.

Decisions approved by the team on 2026-09-25:
1. **Capacity**: stored `assignedCount` plus a conditional `$inc` in the same transaction as the assignment write; decremented on cancel. The validator also enforces `assignedCount ≤ capacity`.
2. **Overlap race**: a lock field on the volunteer document, written in every assignment transaction.
3. **Reassigning after a cancel** reactivates the existing record (the pair is unique), audit logged.
4. **Capacity edits** can't go below the assigned count.
5. **Supervisors read all activities** (not only their own), as the permission table says.
6. **Date edits with assigned volunteers** are allowed, but refused if they create an overlap, naming who.
7. **Transitions**: open can go back to draft only while nobody is assigned; closed and cancelled are final.
8. **Editable** only in draft and open.
9. **Past dates** allowed, both creating and assigning (staff log events after the fact; the demo flow needs it).
10. **Supervisor field** optional, only active staff with role supervisor.
11. **Cancel reason** required for an assignment (3 to 500 characters); cancelling an activity only needs a confirmation.
12. **Assigning** is one volunteer at a time from a searchable list.
13. **List filter** is time based: Próximas, Pasadas, Canceladas, Todas.

## Rationale

The concurrency rules decide the design. Option 1 looks right but is wrong on MongoDB: snapshot isolation only detects conflicts between writes to the same document, so a read then insert check does not stop two concurrent assignments. The fix is to make every competing operation write a shared document. For capacity the natural shared document is the activity itself, and a counter with a conditional `$inc` turns "is there a free place" into one atomic step. For overlap the competing operations share the volunteer, so writing a throwaway lock value there serializes that person's assignments without blocking anyone else's. The driver's `withTransaction` already retries on write conflicts, so no custom retry loop is needed.

The stored counter breaks the usual rule of computing derived values at read time. It is accepted here because it is the concurrency control, not a cached number for display: it only ever changes inside the same transaction as the assignment it counts, and the build includes a check that recounts it. Option 3 would push overlap into an index, but a slot grid is heavy for arbitrary shift times and turns every date edit into a large rewrite; at BAMX's volume it is complexity with no payoff.

The same shared document trick covers the other races: status changes and edits write the activity, so they collide with concurrent assignments; a date change stamps the lock on every assigned volunteer (bounded by capacity) before checking overlaps, so it collides with a concurrent assignment of one of those people elsewhere.

## Feature design

**Data model sketch** (changes to the collections from feature 0; existing fields unchanged):

| Collection | Field | Type | Rule |
|---|---|---|---|
| `activities` | `assignedCount` | int, required | ≥ 0; validator `$expr` requires `assignedCount ≤ capacity` (combined with the existing `endsAt > startsAt` through `$and`); never client supplied |
| `activities` | `supervisorId` | ObjectId, optional | → `staff_users`, N:1; API checks active + role supervisor on write |
| `volunteers` | `assignmentLock` | ObjectId, optional | internal; written with `new ObjectId()` in every assignment transaction; never returned, never audited, never touches `updatedAt` |
| `assignments` | `cancelledAt` | date, optional | set on cancel, removed on reactivation |
| `assignments` | `cancelledBy` | ObjectId, optional | → `staff_users`; set on cancel, removed on reactivation |
| `assignments` | index `(volunteerId: 1, status: 1)` | | for the overlap lookup |

Relationships: volunteer 1:N assignment N:1 activity, unique `(volunteerId, activityId)` (existing). Activity N:1 staff (supervisor, createdBy). The validators are refreshed by `ensureCollections` on startup (collMod), so no separate migration script; there are no existing activity documents to backfill.

Field rules (server zod, mirrored in the app):
| Field | Rule |
|---|---|
| name | trimmed, 3 to 120 chars, no control characters |
| location | trimmed, 2 to 200 chars |
| description | optional, up to 2000 chars |
| requirements | optional, up to 1000 chars |
| startsAt, endsAt | ISO 8601 datetime with offset; `endsAt > startsAt`; duration up to 24 h; startsAt between 2020-01-01 and two years from now |
| capacity | integer 1 to 1000 |
| supervisorId | optional 24 hex ObjectId of an active supervisor; empty string on edit removes it (`$unset`) |
| reason (cancel assignment) | trimmed, 3 to 500 chars |

**State transitions** (activity):

```
draft ──► open ──► closed (final)
  ▲        │
  └────────┘ only while assignedCount = 0
draft ─┬─► cancelled (final)
open ──┘
```

Implemented as a conditional update: `updateOne({ _id, status: <allowed from> [, assignedCount: 0] }, { $set: { status } })`; zero matches → 409. Assignment: `assigned ⇄ cancelled` (cancel needs the activity open; reactivation is the assign endpoint).

**API surface** (all under `/api`, all need a staff session):
| Endpoint | Method | Capability | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|---|
| /activities | GET | activities.read | `when` (upcoming\|past\|cancelled\|all), `q`, `page` | `activities[]` (id, name, location, startsAt, endsAt, capacity, assignedCount, status), `page`, `hasMore` | 400, 401 |
| /activities | POST | activities.write | fields above | `activity` | 400, 401, 403 |
| /activities/:id | GET | activities.read | | `activity`, `supervisor` ({id, fullName} or null), `participants[]` (assignmentId, volunteerId, firstName, lastName, phone, status, cancelledReason) | 401, 404 |
| /activities/:id | PATCH | activities.write | any editable field | `activity` | 400, 401, 403, 404, 409 (not editable, capacity below count, date overlap with `conflicts[]`) |
| /activities/:id/status | POST | activities.write | `status` (draft\|open\|closed\|cancelled) | `activity` | 400, 401, 403, 404, 409 |
| /activities/:id/assignments | POST | assignments.write | `volunteerId` | `assignment` (201 new, 200 reactivated) | 400, 401, 403, 404, 409 (not open, inactive, full, already assigned, overlap) |
| /activities/:id/assignments/:assignmentId/cancel | POST | assignments.write | `reason` | `assignment` | 400, 401, 403, 404, 409 (already cancelled, activity not open) |
| /staff/supervisors | GET | activities.write | | `supervisors[]` (id, fullName) of staff with `active: true` and `role: supervisor`, sorted by name | 401, 403 |

The assign picker reuses `GET /api/volunteers?status=active&q=` from spec 0003.

**Assign transaction** (in order, inside `withTransaction`; any 409 aborts it):
1. Load the volunteer (404 if missing; 409 if inactive) and the assignment for this pair (409 if already `assigned`).
2. Conditional `$inc` of `assignedCount` on the activity with `status: 'open'` and `$expr: { $lt: ['$assignedCount', '$capacity'] }`; zero matches → reload to tell "not open" from "full", 409.
3. `$set: { assignmentLock: new ObjectId() }` on the volunteer.
4. Overlap lookup: the volunteer's `assigned` assignments joined with their activities where status ≠ cancelled and times overlap this one; any → 409 naming the first.
5. Insert the assignment, or reactivate the cancelled one; write the audit entry.

Two parallel assigns of the same pair both write the same activity and volunteer documents, so one hits a write conflict, `withTransaction` retries it, and its step 1 now sees `assigned` and answers 409. As a safety net the insert also catches a duplicate key error (`MongoServerError` code 11000 on `assignments_volunteer_activity_unique`) and answers the same 409, never a 500.

Changes to `assignedCount` and `assignmentLock` are internal bookkeeping: they get no audit entry of their own. The assignment's `insert` or `update` entry records the change (for a date or capacity edit, the activity's own `update` entry does).

**Date edit transaction**: if `startsAt` or `endsAt` changes and `assignedCount > 0`: stamp `assignmentLock` on every assigned volunteer, run the overlap lookup for each against the new times (excluding this activity), collect all conflicts, 409 with the full list if any; else update and audit.

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| create | status, assignedCount | always `draft`, `0` (server) |
| create | createdBy | `currentStaff(response).id` |
| create/edit | startsAt, endsAt | app builds them from the date and time pickers in the device timezone (`America/Mexico_City` on BAMX phones) and sends ISO with offset; server stores UTC |
| list | "not yet ended" for `upcoming`/`past` | `endsAt` compared with the server clock (`new Date()`) |
| list | page size, `hasMore` | constant 20; `page` starts at 1; fetch 21 rows, `hasMore` when the 21st exists (same as spec 0003) |
| detail | supervisor.fullName | `staff_users` by `supervisorId`, projected to `fullName` only |
| detail | participants | `assignments` for the activity joined with `volunteers` (name, phone), sorted assigned first, then last name |
| assign | assignedBy | `currentStaff(response).id` |
| assign | overlap message | the conflicting activity's `name` and `startsAt` formatted in `es-MX`, `America/Mexico_City` |
| cancel | cancelledAt, cancelledBy | server clock, `currentStaff(response).id` |
| date edit | `conflicts[]` | per conflict: volunteerId, volunteer full name, other activity id and name |
| audit | actorId | `currentStaff(response).id`; snapshots exclude `assignmentLock` |
| app | which actions show | `roleCan` in `src/constants/roles.ts` (add `editActivities`, `assignVolunteers`) mirroring `permissions.ts` |

**Key invariants**:
- `assignedCount` equals the number of `assigned` assignments of the activity, and never exceeds `capacity`.
- No volunteer has two `assigned` assignments on non cancelled activities whose times overlap.
- Assignments are created only on `open` activities for `active` volunteers.
- No endpoint deletes; `status`, `assignedCount`, `createdBy`, `assignedBy`, cancel fields, `assignmentLock` and timestamps are never client supplied (zod `.strict()`).
- Every write and its audit entry commit in the same transaction.
- `assignmentLock` never appears in any API response or audit snapshot (volunteer projections are explicit already; the lock update never goes through the audited volunteer writes).

**Security model**: see `AGENTS.md` → Roles and permissions. Reads: `activities.read` (all roles, all activities). Activity writes and the supervisor list: `activities.write` (admin, coordinator). Assign and cancel: `assignments.write` (admin, coordinator). Participant phones are visible to supervisors, consistent with spec 0003. Logs carry only ids and actions (`log` from `server/src/logger.ts`), never names, not even the names in the overlap message. The app hides actions with `roleCan`; the server is the protection.

**Configuration required**: none (no new environment variables).

**App screens** (`src/app/(tabs)/actividades/` becomes a folder with a Stack `_layout.tsx`, like Voluntarios):
- `index.tsx`: `Screen` with search and `FilterChips` (Próximas, Pasadas, Canceladas, Todas) in the band; rows show name, date and time range, location, `assigned/capacity`, `StatusBadge`; `Fab` "Nueva actividad" for admin and coordinator; pagination on scroll; `EmptyState` per filter.
- `nueva.tsx` and `[id]/editar.tsx`: one shared `src/components/activity-form.tsx`; date and time pickers from `@expo/ui` (reuse the `date-field.tsx` pattern, add a time field); supervisor picker from `/api/staff/supervisors` with a "Sin supervisor" option.
- `[id]/index.tsx`: three sections. **Detalles** (data, supervisor, status, actions by status: Publicar, Volver a borrador, Cerrar, Cancelar actividad with a confirmation, Editar). **Participantes** (`assigned/capacity`, assigned list then a "Cancelados" group with reasons; "Asignar voluntario" and per row "Cancelar asignación" asking for the reason, both only when open and for admin and coordinator). **Asistencia** (an `EmptyState` saying attendance arrives with feature 4).
- `[id]/asignar.tsx`: searchable list of active volunteers; people already assigned are marked and not tappable; tapping assigns and returns, or shows the plain 409 message.
- API client `src/services/activities.ts` on `apiRequest()`.

**Critical test scenarios**:
- Happy path: coordinator creates a draft, publishes, assigns two volunteers, cancels one with a reason, reassigns them, closes; audit entries for each step and `assignedCount` right after each, verifies **AC-1**, **AC-3**, **AC-5**, **AC-8**, **AC-9**
- Concurrency: 10 parallel assigns into an activity with capacity 3 → exactly 3 succeed, count is 3; one volunteer assigned in parallel to two overlapping activities → exactly one succeeds; the same pair assigned (and reassigned after a cancel) twice in parallel → one success, one 409, no 500, verifies **AC-7**, **AC-8**
- Rules: assign to draft, closed, cancelled; inactive volunteer; full; already assigned; overlapping; back to back allowed, verifies **AC-6**, **AC-11**
- Edit: capacity below count 409; date move that double books an assigned volunteer 409 with their name; edit on closed 409; open → draft with people assigned 409, verifies **AC-3**, **AC-4**, **AC-10**
- Permission: supervisor gets 403 on every write and on `/staff/supervisors`; no token 401; bad id 404, verifies **AC-14**
- List and detail: each `when` filter and search; participants order, verifies **AC-12**, **AC-13**

## Build plan

Tracer bullet: one thin working path first (create and list an activity on the phone), then thicken.

1. Schema: `assignedCount`, `assignmentLock`, cancel fields, the `$and` validator, the new index, and the `capacity` maximum lowered from 10000 to 1000 in `server/src/collections.ts`; types updated, satisfies **AC-1**, **AC-7**
2. `server/src/activities.ts` with create and list (zod schemas, `when` filters, search), mounted in `app.ts`; app list screen and create form end to end on the emulator, satisfies **AC-1**, **AC-2**, **AC-12**
3. Detail, status transitions, edit (without date overlap yet), `/staff/supervisors`; app detail with Detalles and actions, edit form, supervisor picker, satisfies **AC-3**, **AC-4**, **AC-13**, **AC-14**
4. Assign and cancel endpoints with the transaction above (counter, lock, overlap, reactivation); app Participantes section and `asignar` screen, satisfies **AC-5**, **AC-6**, **AC-8**, **AC-9**, **AC-11**
5. Date edit overlap check with the `conflicts[]` response, and its message in the edit form, satisfies **AC-10**
6. API checks against Atlas for every AC, including the parallel requests for **AC-7** and a recount of `assignedCount`; temporary records removed afterwards, satisfies **AC-1** to **AC-14**
7. Walk the flow on the Android emulator as coordinator and as supervisor; update `scope.md` and `AGENTS.md` (data model rows, pointer to `activities.ts`), satisfies **AC-14**

## Consequences

**Positive**:
- Capacity and double booking are enforced by the database's own conflict detection, not by timing luck; the same pattern serves attendance later.
- Steps 4 and 5 of the MVP demo flow work, and the volunteer detail from spec 0003 starts showing real history.

**Negative / tradeoffs**:
- `assignedCount` is a stored derived value; any future code path that changes assignments must go through these service functions or the count drifts.
- Every volunteer read projection must keep excluding `assignmentLock`; a new endpoint that returns a whole volunteer document would leak an internal (harmless but untidy) field.
- Assignments under contention may be retried by the driver, so a busy moment costs a few extra round trips to Atlas.
- Allowing past dates means a typo in the year creates an activity in the past without warning (mitigated by the 2020 lower bound).

**Neutral**:
- Deactivating a volunteer does not touch their existing assignments; they stay assigned until someone cancels them.
- Participants are not paginated; the list is bounded by capacity (up to 1000) plus cancellations.

## Follow-up

- [ ] Feature 4: decide whether cancelling an assignment is blocked once it has attendance, and whether recording attendance requires the activity to be closed.
- [ ] Decide whether deactivating a volunteer should warn about or cancel their future assignments (feature 2 follow up).
- [ ] Feature 4: an activity keeps its `supervisorId` if that supervisor is later deactivated; the supervisor's "own activities" grant must also require the supervisor to be active (already true in practice, since deactivated staff are signed out).
- [ ] Hardening (feature 8): turn the AC-7 parallel request check into an automated test.
