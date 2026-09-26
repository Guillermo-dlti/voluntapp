# 0005. Attendance and hours: record, finalize, correct

**Date**: 2026-09-25
**Status**: Implemented

## Summary

Once an activity has started, staff record for each assigned volunteer whether they came (present, late, or absent), optional check in and check out times, and their hours. A "mark everyone present" button covers the common case. When everyone has a record, staff finalize the activity's attendance in one step: the records lock, the activity closes, and those hours start counting in the volunteer's totals (and later in reports). After that only an admin can change a record, and they must give a reason that stays in the audit log.

## Context

This is feature 4 of `scope.md` and steps 6 to 8 of the MVP demo flow (record attendance and hours, finalize, the volunteer's history and total hours update). It stands on spec 0002 (sessions, `requireStaff`, the permission map with `attendance.record`, `attendance.finalize` and `attendance.correctFinalized` already defined), spec 0003 (the volunteer detail already computes totals from finalized attendance), and spec 0004 (assignments, the transaction plus audit pattern, and the "every competing write touches a shared document" concurrency rule). The `attendance` collection, its validator (hours 0 to 24, `checkOutAt > checkInAt`) and its unique `assignmentId` index exist since feature 0; no documents exist yet.

Two business rules from `AGENTS.md` apply directly. Rule 5: once attendance is finalized, only an admin can change it, and the change is audit logged. Rule 6: hours can't exceed the activity's length, and check out comes after check in. The permission table adds a scoping rule: supervisors may record and finalize only on activities where they are the `supervisorId`.

Finalization is the moment numbers become official. Reports (feature 6) and the volunteer totals read only finalized records, so finalizing with a missing record, or letting a record change during the finalize itself, would silently put a wrong number into every report. The same concurrency trap as spec 0004 applies: MongoDB transactions only detect conflicts between writes to the same document, so "check that everyone is recorded, then finalize" and "record one more person" can both commit unless they share a write.

Constraints: staff use Android phones in the field, often marking 10 to 40 people per activity; activities can cross midnight (spec 0004); times are entered as Guadalajara wall clock and stored as UTC; security is graded, so every change is scoped by role on the server and audit logged.

## Requirements

**User stories**:
- As a coordinator or the activity's supervisor, I want to mark everyone present in one tap and then adjust the few who were late or absent, so taking attendance on a phone takes a minute.
- As a coordinator or the activity's supervisor, I want to finalize an activity's attendance once, so the hours become official and count in each volunteer's totals.
- As an admin, I want to correct a finalized record with a reason, so mistakes can be fixed without hiding that they happened.
- As any staff member, I want to see each activity's attendance and whether it is finalized.

**Acceptance criteria**:
- **AC-1**: Admin, coordinator, or the activity's supervisor records attendance for an `assigned` assignment of an activity that is `open` or `closed`, whose `startsAt` has passed, and whose attendance is not finalized. The record stores `status` (present, late, absent), optional `checkInAt` and `checkOutAt`, `hours`, `recordedBy`, `finalized: false`, and writes an `insert` audit entry. Recording again for the same assignment updates the same record (`update` audit entry with before and after). Otherwise 409 with a plain message: activity is a draft, cancelled, not started yet, or already finalized; assignment is cancelled.
- **AC-2**: Hours are calculated when not given: absent is 0; present or late with both times is the time between them; present or late without both times is the full activity length. Given hours are accepted when ≥ 0, at most the activity length, and at most the check in to check out span when both times are given. All hours are rounded to 2 decimals first, then compared against the limits (also rounded to 2 decimals); a value over a limit is a 400, never trimmed silently.
- **AC-3**: Times are optional. When given, each falls between the activity's `startsAt` and `endsAt` (inclusive), and `checkOutAt` is after `checkInAt`. An absent record carries no times and 0 hours (400 otherwise). Invalid input gets field level Spanish messages, in the app before sending and from the API (400 with `fields`).
- **AC-4**: "Marcar todos presentes" creates a present record with the full activity length for every `assigned` assignment that has no record yet, leaves existing records untouched, writes one `insert` audit entry per created record, and returns how many it created. When nobody is left to mark it answers 200 with `created: 0` and writes no audit entry. Same preconditions as AC-1.
- **AC-5**: Finalizing is refused with 409 when any `assigned` assignment has no record; the message and a `missing` list name each person. Otherwise, in one transaction: every record of the activity gets `finalized: true`, `finalizedAt`, `finalizedBy`; the activity gets `attendanceFinalizedAt`, `attendanceFinalizedBy`, and moves from `open` to `closed` (a `closed` activity stays closed); an `update` audit entry is written for each record and for the activity. Finalizing an already finalized activity is 409. An activity with no assigned people cannot be finalized (409).
- **AC-6**: After finalizing, the recording, mark all, and finalize endpoints answer 409 for every role. Only an admin can correct a finalized record: status, times, and hours under the same rules as AC-2 and AC-3, plus a required `reason` (3 to 500 characters). The record keeps `finalized: true` and gets `correctionReason`, `correctedAt`, `correctedBy`; `recordedBy` is left as it was; an `update` audit entry holds before and after. Coordinators and supervisors get 403; correcting a record that is not finalized is 409.
- **AC-7**: Cancelling an assignment that has an attendance record is refused with 409 and a message that says to mark the person absent instead.
- **AC-8**: Concurrency holds: a finalize running at the same time as a recording, a mark all, an assignment, or an assignment cancel on the same activity never produces a finalized activity with an unrecorded or unfinalized assigned person, and never an attendance record on a cancelled assignment.
- **AC-9**: The activity detail returns, per assigned participant, their attendance (status, checkInAt, checkOutAt, hours, finalized, correctionReason) or null (always null for cancelled participants), plus the activity's `attendanceFinalizedAt`. The volunteer detail's totals and history (spec 0003) reflect a finalized record right after finalizing and after a correction.
- **AC-10**: Supervisors record, mark all, and finalize only on activities where they are the `supervisorId`; on any other activity they get 403. They can still read every activity's attendance. No session gets 401; unknown activity or assignment ids, or an assignment of another activity, get 404. The app hides the actions a user can't take.

## Options considered

### Option 1: Per record writes, finalize checks then flags

Each recording writes only its own attendance document; finalize counts the assigned assignments and the records, and if they match runs `updateMany` to set `finalized` and updates the activity.

**Pros**:
- Fewest writes; recordings on different people never wait on each other.
- No internal fields beyond the ones already agreed.

**Cons**:
- The rules that span documents race. A recording that inserts a record for an assignment being cancelled at the same moment shares no document with the cancel, so both commit and leave attendance on a cancelled assignment. A recording that reads "not finalized" in its snapshot and inserts a new record can commit next to a finalize that has already checked the count, depending on timing.

### Option 2: Every attendance write also stamps the activity (recommended)

Every recording, mark all, and correction starts its transaction with a conditional update on the activity (`status` open or closed, started, `attendanceFinalizedAt` missing for non corrections) that sets an internal `attendanceLock` to a fresh ObjectId. Finalize, assign, and assignment cancel already write the activity. So any two operations that could break an attendance rule write the same document, MongoDB raises a write conflict, and the driver's `withTransaction` retries the loser against the committed state. This is the same pattern as `volunteers.assignmentLock` in spec 0004.

**Pros**:
- Correct by construction: all the attendance rules that span documents (finalize completeness, no record on a cancelled assignment, no write after finalize) are checked by a transaction that has written the activity first.
- The precondition check and the conflict point are one conditional update.
- Reuses a pattern the team already built and verified.

**Cons**:
- Recordings on the same activity serialize: two staff marking different people at the same second cause one driver retry. At 10 to 40 people with one or two staff per activity this costs milliseconds.
- One more internal field that every activity projection must keep hidden (`publicActivity` is already an explicit projection).

### Option 3: Attendance embedded in the assignment

Store status, times, and hours on the assignment document itself, dropping the separate collection.

**Pros**:
- Cancel and record naturally write the same document.

**Cons**:
- Contradicts the data model in `AGENTS.md` and the existing validator and unique index; the volunteer detail aggregation would change. Finalize still needs the activity as a shared point, so the race is only half solved.

## Decision

**Chosen option**: Option 2: Every attendance write also stamps the activity

Attendance routes live in a new `server/src/attendance.ts` mounted under `/api/activities/:id/attendance`; every write runs in one transaction that first conditionally stamps `activities.attendanceLock`, then writes the attendance record(s) and their audit entries.

Decisions approved by the team on 2026-09-25:
1. **When**: attendance can be recorded once the activity has started (open or closed, `startsAt` passed); never on drafts or cancelled activities.
2. **Hours**: calculated from times (or the full length), editable, capped at the activity length; absent is 0.
3. **Finalize** applies to the whole activity at once.
4. **Missing records** block finalizing, naming who is missing.
5. **Finalizing closes** an open activity in the same transaction.
6. **Recording UX**: "Marcar todos presentes", then adjust individuals in a form.
7. **Corrections** require a reason stored on the record (`correctionReason`, `correctedAt`, `correctedBy`).
8. **Cancelling an assignment** with an attendance record is blocked (closes spec 0004's follow up).
9. **Times** optional, inside the activity window.
10. **The activity records finalization** in `attendanceFinalizedAt` and `attendanceFinalizedBy`.
11. **No reopening**: admins correct individual records; the activity stays finalized.

Calls made in this spec (the team can override):
- **`attendanceLock` on the activity** (Option 2) over per record writes: it is the only way the cross document rules hold under concurrency. Runner up: stamping the assignment instead, which fixes the cancel race but not finalize completeness.
- **Recording is an upsert per assignment** (`PUT`), so retrying the same request is safe. Runner up: separate create and update endpoints, which add a "does it exist yet" step to the app for no gain.
- **Hours also capped by the check in to check out span** when both times are given, so a record never contradicts itself. Runner up: cap only by activity length, as rule 6 says literally.
- **Attendance shown inside the activity detail response** rather than a separate endpoint: the detail already lists participants, and one request keeps the Asistencia section in step with Participantes.
- **Correction does not cap by `attendanceFinalizedAt`**: an admin can correct any finalized record at any later date; the audit trail carries the history.

## Rationale

The decisive force is that finalization turns attendance into official numbers for totals and reports, and three of its rules span documents: "everyone assigned has a record", "no record on a cancelled assignment", and "no change after finalizing except by an admin". Option 1 enforces each with a read, and MongoDB's snapshot isolation lets two transactions that only read the same document both commit, which is exactly how the capacity bug in spec 0004's Option 1 would have happened. Option 2 makes the activity the one document every competing operation writes: finalize writes it (status, finalized fields), assign and cancel already write it (`assignedCount`), and now every attendance write stamps it too. Whichever commits second is retried and sees the first one's result.

The cost is that recordings on one activity run one at a time. BAMX's shape makes that irrelevant: one supervisor or coordinator per activity, tens of people, taps seconds apart. Spec 0004 already accepted the same tradeoff for volunteers, and reusing a known pattern means the team verifies it with the same parallel request checks.

The remaining decisions keep the numbers trustworthy for staff who are not thinking about data integrity: blocking finalization on missing records means no hours are decided silently; closing the activity on finalize means no one can be assigned after the hours are official; and a stored correction reason makes each admin edit explainable, both on the record and in `audit_log`, which matters for the Cybersecurity grade.

## Feature design

**Data model sketch** (changes to the collections from feature 0; existing fields unchanged):

| Collection | Field | Type | Rule |
|---|---|---|---|
| `activities` | `attendanceFinalizedAt` | date, optional | set once by finalize; never client supplied |
| `activities` | `attendanceFinalizedBy` | ObjectId → `staff_users`, optional | set with the field above |
| `activities` | `attendanceLock` | ObjectId, optional | internal; `new ObjectId()` in every attendance write transaction; never returned, never audited, never touches `updatedAt` |
| `attendance` | `correctionReason` | string, optional | 3 to 500 chars; latest correction wins, earlier ones stay in `audit_log` |
| `attendance` | `correctedAt` | date, optional | set with `correctionReason` |
| `attendance` | `correctedBy` | ObjectId → `staff_users`, optional | set with `correctionReason` |

Relationships: assignment 1:0..1 attendance (unique `assignmentId`, existing); only `assigned` assignments get one. Activity N:1 staff (`attendanceFinalizedBy`); attendance N:1 staff (`recordedBy`, `finalizedBy`, `correctedBy`). The validators are refreshed by `ensureCollections` on startup (collMod), so there is no separate migration; no attendance documents exist to backfill. Hours stay 0 to 24 in the validator (activities are at most 24 hours long).

Field rules (server zod, mirrored in the app; `.strict()`):
| Field | Rule |
|---|---|
| status | `present` \| `late` \| `absent` |
| checkInAt, checkOutAt | optional ISO 8601 datetime with offset; each within `[startsAt, endsAt]`; `checkOutAt > checkInAt` when both; not allowed when absent |
| hours | optional number ≥ 0, rounded to 2 decimals; ≤ activity length; ≤ span when both times; must be 0 (or omitted) when absent |
| reason (correction only) | trimmed, 3 to 500 chars |

**State transitions**:

```
attendance record:  (none) ──record/mark all──► recorded (finalized: false) ⇄ edited
                    recorded ──finalize (whole activity)──► finalized (final) ──admin correct──► finalized
activity:           open ──finalize──► closed   (closed stays closed; attendanceFinalizedAt set)
```

**API surface** (all under `/api/activities/:id/attendance`, all need a staff session; supervisor `own` grants checked with `canOnActivity` against the activity's `supervisorId`):
| Endpoint | Method | Capability | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|---|
| `/:assignmentId` | PUT | attendance.record | status, checkInAt?, checkOutAt?, hours? | `attendance` (201 created, 200 updated) | 400, 401, 403, 404, 409 (not started, draft/cancelled, finalized, assignment cancelled) |
| `/mark-all-present` | POST | attendance.record | none | `created` (count) | 401, 403, 404, 409 (same preconditions) |
| `/finalize` | POST | attendance.finalize | none | `activity`, `finalized` (count) | 401, 403, 404, 409 (already finalized, nobody assigned, `missing[]`) |
| `/:assignmentId/correct` | POST | attendance.correctFinalized | status, checkInAt?, checkOutAt?, hours?, reason | `attendance` | 400, 401, 403, 404, 409 (not finalized) |

Changed existing endpoints:
- `GET /api/activities/:id` adds `activity.attendanceFinalizedAt` (null when not finalized) and, per participant, `attendance` (status, checkInAt, checkOutAt, hours, finalized, correctionReason) or null.
- `POST /api/activities/:id/assignments/:assignmentId/cancel` first stamps `attendanceLock` together with its existing write, then refuses with 409 when the assignment has an attendance record (AC-7).

**Write transactions** (inside `client.withSession` + `withTransaction`; any 409 aborts it):
- *Record / mark all*: (1) `activities.updateOne({ _id, status: { $in: ['open','closed'] }, startsAt: { $lte: now }, attendanceFinalizedAt: { $exists: false } }, { $set: { attendanceLock: new ObjectId() } })`; zero matches → reload to pick the plain 404 or 409 message. (2) Load the assignment(s) with `status: 'assigned'` for this activity (404 if it belongs to another activity, 409 if cancelled). (3) Validate times and hours against the activity; insert or update the record(s); audit.
- *Finalize*: (1) same conditional stamp, which also sets `status: 'closed'` when open, `attendanceFinalizedAt`, `attendanceFinalizedBy` (all in one update; `attendanceFinalizedAt: { $exists: false }` in the filter makes a second finalize a 409). (2) Load `assigned` assignments (409 if none) and their records; any missing → abort with `missing[]`. (3) `updateMany` the records to `finalized: true`, `finalizedAt`, `finalizedBy`; audit each record and the activity.
- *Correct*: stamp the lock with the filter `attendanceFinalizedAt: { $exists: true }`, load the record (409 if not finalized), validate, update, audit.

The step order puts the activity write first so any conflict is found before the reads that the rule depends on; after a retry, those reads see the committed state. Each request reads `now` once, before the transaction, and uses that value for every check and timestamp inside it.

Why the pairs collide: a recording never writes the assignment document, and a cancel never writes the attendance collection; they conflict only because both write the activity (the lock stamp and `assignedCount`). Likewise, the existing assign and cancel filters require `status: 'open'`, so once finalize closes the activity they stop matching; the AC-7 check therefore only matters before finalizing.

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| record | recordedBy | `currentStaff(response).id` (updated to the latest recorder on edit; never changed by a correction) |
| every write | now | `new Date()` read once per request, before the transaction, reused for every check and timestamp |
| record | "started" | activity `startsAt` compared with the server clock (`new Date()`) |
| record | activity length | `endsAt − startsAt` in hours, from the activity document |
| record | default hours | derived per AC-2 from status, times, activity length; `Math.round(x * 100) / 100` |
| record (app) | checkInAt, checkOutAt | `TimeField` wall clock in `America/Mexico_City`; the app places the time on the date that falls inside the activity window (for an activity crossing midnight, a time earlier than the start time is the next day) via `mexicoMoment`; sent as ISO with offset |
| mark all | which people | `assigned` assignments of the activity with no attendance record |
| finalize | finalizedAt, finalizedBy, attendanceFinalizedAt/By | server clock, `currentStaff(response).id` |
| finalize | `missing[]` | per missing person: assignmentId, volunteer first and last name (from `volunteers`) |
| correct | correctedAt, correctedBy | server clock, `currentStaff(response).id` |
| detail | per participant attendance | `$lookup` from `attendance` on `assignmentId`, projected to the listed fields |
| volunteer totals | hours, completed | existing aggregation in `server/src/volunteers.ts` (finalized only), unchanged |
| audit | actorId; snapshots | `currentStaff(response).id`; activity snapshots exclude `attendanceLock` and `assignmentLock` never appears |
| app | which actions show | `roleCan` in `src/constants/roles.ts` (add `recordAttendance`, `correctAttendance`) plus a check of `supervisorId === user.id` for supervisors, mirroring `canOnActivity` |

**Key invariants**:
- Every `assigned` assignment of an activity with `attendanceFinalizedAt` has exactly one attendance record, and that record has `finalized: true`.
- No attendance record points at a `cancelled` assignment.
- `hours` is between 0 and the activity length (2 decimals), is 0 when absent, and never exceeds the check in to check out span.
- A finalized record changes only through the admin correction endpoint, which always stores a reason.
- `attendanceFinalizedAt` is set once and never removed; an activity with it set is `closed`.
- Every attendance write and its audit entry commit in the same transaction; no endpoint deletes an attendance record.
- `attendanceLock` never appears in an API response or audit snapshot.

**Security model**: see `AGENTS.md` → Roles and permissions. Read: `activities.read` (all roles, all activities, attendance included). Record and mark all: `attendance.record`; finalize: `attendance.finalize`; both `all` for admin and coordinator, `own` for supervisors (the route loads the activity and calls `canOnActivity`, 403 otherwise). Correct: `attendance.correctFinalized`, admin only. Deactivated staff are already signed out, so an old supervisor keeps no access through a stale `supervisorId`. Logs carry only ids and actions; the `missing[]` names go to the response, never to `log`. The app hides actions with `roleCan` and the supervisor check; the server is the protection.

**Configuration required**: none (no new environment variables).

**App screens** (in `src/app/(tabs)/actividades/[id]/`):
- `index.tsx`, section **Asistencia** (replaces the placeholder): before the start time, an `EmptyState` saying attendance opens when the activity begins; after, a count ("12 de 15 registrados") and each assigned person with a `StatusBadge` (Sin registrar, Presente, Tarde, Ausente) and hours; buttons "Marcar todos presentes" (while anyone is unrecorded) and "Finalizar asistencia" (with a confirmation that says hours become official and the activity closes; a 409 shows who is missing). When finalized: a "Asistencia finalizada" line with the date, rows read only, and for admins each row opens the correction form. Draft and cancelled activities show a short line saying attendance does not apply.
- `asistencia/[assignmentId].tsx`: status chips, check in and check out `TimeField`s (hidden when absent), hours field empty with the calculated value as a placeholder and a hint with the maximum, "Guardar"; in correction mode a required reason field and "Guardar corrección". Leaving hours empty lets the API recalculate them when staff change a time; an entered number overrides that calculation.
- API client additions in `src/services/activities.ts` on `apiRequest()`; rules mirrored in `src/utils/attendance-rules.ts`.

**Critical test scenarios**:
- Happy path: coordinator marks all present on a started activity, sets one late with times and one absent, finalizes; activity is closed, records finalized, audit entries written, volunteer detail shows the hours, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-9**
- Rules: record before start, on a draft, on a cancelled activity, on a cancelled assignment → 409; times outside the window, checkout before checkin, hours over the length or over the span, absent with hours → 400; finalize with a missing person → 409 naming them, verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**
- After finalize: record, mark all, finalize → 409; coordinator correct → 403; admin correct without reason → 400, with reason → saved, audit before and after, totals change, verifies **AC-6**, **AC-9**
- Cancel an assignment with a record → 409, verifies **AC-7**
- Concurrency: finalize in parallel with a recording of the last missing person (never finalized with a gap); finalize in parallel with an assign (either the assign fails because the activity closed, or finalize reports the new person missing); record in parallel with cancel on the same assignment (exactly one wins); two finalizes in parallel (one 200, one 409); no 500 in any of them, verifies **AC-8**
- Permission: supervisor records and finalizes on their own activity, gets 403 on another's and on correct; no token 401; another activity's assignment id 404, verifies **AC-10**

## Build plan

Tracer bullet: one thin path first (record one person on a started activity and see it in the detail on the phone), then thicken.

1. Schema: `attendanceFinalizedAt`, `attendanceFinalizedBy`, `attendanceLock` on activities; `correctionReason`, `correctedAt`, `correctedBy` on attendance, in `server/src/collections.ts` and its types, satisfies **AC-5**, **AC-6**
2. `server/src/attendance.ts` with `PUT /:assignmentId` (lock stamp, preconditions, hours and time rules, upsert, audit), mounted in `app.ts`; detail endpoint returns attendance per participant; app Asistencia section and the record form end to end on the emulator, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-9**
3. Mark all present (API and button), satisfies **AC-4**
4. Finalize (API with `missing[]`, closing the activity; app button, confirmation, finalized state), satisfies **AC-5**, **AC-9**
5. Admin correction (API and correction mode of the form), satisfies **AC-6**
6. Assignment cancel stamps the lock and refuses when a record exists; message in the Participantes cancel dialog, satisfies **AC-7**
7. Supervisor `own` checks in every write route and the app's action visibility, satisfies **AC-10**
8. API checks against Atlas for every AC, including the parallel requests for **AC-8**; temporary records removed afterwards, satisfies **AC-1** to **AC-10**
9. Walk the flow on the Android emulator as coordinator, supervisor (own and other activity), and admin (correction); check the volunteer's totals update; update `scope.md`, satisfies **AC-9**, **AC-10**

## Consequences

**Positive**:
- Steps 6 to 8 of the MVP demo flow work, and volunteer totals start showing real hours.
- Finalized numbers are guaranteed complete and stable, so reports (feature 6) can read `finalized: true` records and `attendanceFinalizedAt` without extra checks.
- Every admin correction explains itself on the record and in the audit log.

**Negative / tradeoffs**:
- Attendance writes on one activity serialize through `attendanceLock`; heavy parallel recording on one activity causes driver retries.
- A second internal field on activities that every projection must keep hidden.
- Blocking finalization on missing records means one forgotten person holds the whole activity open until someone records them (by design, but staff will hit it).
- No reopen: a large mistake across many records means many admin corrections, each with a reason.
- Finalizing also closes the activity, so staff who want to finalize while still assigning late arrivals must assign first.

**Neutral**:
- `recordedBy` holds the last person who recorded or edited before finalizing; the audit log keeps the full sequence.
- Attendance is only for `assigned` people; someone who showed up without an assignment must be assigned first (allowed after the start, spec 0004 decision 9).
- Deactivated volunteers keep their assignments, so their attendance can still be recorded.

## Follow-up

- [ ] `/sync`: add the new fields to the data model table in `AGENTS.md` and a pointer to `server/src/attendance.ts`.
- [ ] Feature 5 (dashboard): "pending finalization" = activities with `status` open or closed, `endsAt` passed, no `attendanceFinalizedAt`.
- [ ] Feature 6 (reports): read hours only from `finalized: true` records; date ranges by the activity's `startsAt`.
- [ ] Hardening (feature 8): turn the AC-8 parallel request checks into automated tests.
