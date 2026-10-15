# 0009. QR check in: decision record

Build spec: [index.md](index.md).

## Context

Taking attendance today means finding each person in the roll call list and tapping Presente, Tarde or Falta (spec 0005, reworked in 0007). With 10 to 40 people arriving at a warehouse door, the list is slow: staff search names while a line forms. v1 had a mock QR check in on the volunteer's own phone, but volunteers don't log in in v2 (`AGENTS.md`), so the QR has to be something staff can read off a card, a screenshot or another screen.

The forces: security is graded, so a code on a printed card must not leak personal data, must not be guessable, and must not let anyone without a staff session do anything. Every write must keep the existing guarantees: role and own activity checks from `server/src/permissions.ts`, the attendance gate (`attendanceOpened()`, not finalized, not draft or cancelled), the schedule rules for check in times (spec 0005 AC-2), the one record per assignment unique index, and an `audit_log` entry in the same transaction. A scan arrives with nothing but a code and an activity, so the server has to resolve the volunteer, the assignment and the times itself.

The team will demo this on a real Android phone through Expo Go (SDK 57), not the dev build the project normally uses (spec 0001). That constrains the libraries (only what Expo Go ships with) and the network setup (the phone can't reach `localhost`).

Assumptions taken from earlier specs: staff sessions and `requireStaff` (0002), the volunteer record (0003), assignments with `status: 'assigned'` (0004), attendance records and the `stampOpen` gate (0005), "Iniciar asistencia" (`attendanceStartedAt`, scope 5c), the activity flow module (0007).

## Options considered

### Option 1: Random token per volunteer, resolved on the server (scan inside the attendance router)

Each volunteer stores a random 192 bit token. The QR holds only the token. The scanner posts `{ token }` to `POST /api/activities/:id/attendance/check-in`, which lives in `server/src/attendance.ts` next to the other attendance writes and reuses `loadActivity`, `stampOpen` and `attendanceValues`.

**Pros**:
- The code on a card reveals nothing and can't be guessed; it only works through a signed in staff session.
- One copy of the attendance rules: the scan is just another writer behind the same gate and transaction.
- Revocation is one field update.

**Cons**:
- The token is stored in plain form so the QR can be redrawn; a database leak would expose working codes (usable only with a staff session).
- A new unique index and a backfill for existing volunteers.

### Option 2: Signed QR (HMAC of the volunteer id), no stored token

The QR holds the volunteer id plus an HMAC signature made with a server secret. The server checks the signature, then looks the volunteer up by id.

**Pros**:
- No schema change and no backfill; nothing secret stored in the database.

**Cons**:
- The QR carries the Mongo `_id`, which the requirement rules out.
- Revoking one card means a per volunteer version counter anyway, or rotating the secret for everyone.
- A new secret to manage in `.env`.

### Option 3: Scan resolves the volunteer only; the app records through the existing PUT

A small `GET /api/checkin/:token` returns the volunteer, the app finds the assignment and calls the existing roll call `PUT`.

**Pros**:
- No new write path on the server.

**Cons**:
- Two round trips per scan and a lookup endpoint that turns a token into personal data on its own.
- The "already registered", "not assigned" and time clamping rules move to the phone, where they can't be trusted and race between phones.

## Rationale

The graded constraint is that the card itself must be harmless. A random token carries no data and no id, can't be enumerated (192 bits), and does nothing without a staff session, a role check and an own activity check. Storing it in plain form is deliberate: staff must be able to reopen a volunteer's QR at any time, and the token is a pointer, not a credential (a session token, which is a credential, stays hashed). Regeneration covers a lost or leaked card, and keeping the token out of logs, lists and audit snapshots keeps it in exactly one place.

Putting the endpoint in the attendance router is what keeps the rules single sourced. The scan needs the same gate as the roll call (`stampOpen`, which also serializes concurrent writers on the activity), the same hours checks (`attendanceValues`), and the same audit entry. A separate router or a client side flow would copy those rules and drift. The `/api/activities/:id/...` path also gives the scanner its activity from the route, the way every other attendance call works.

Recording a check in time (instead of full hours like "Marcar todos") was the engineer's call: it makes a scan carry real information (who came late) and the late status falls out of it. Clamping early scans to `startsAt` keeps spec 0005's "times inside the schedule" rule intact even when attendance was started early, and refusing scans after `endsAt` avoids zero hour records. The cost is that a scan can't record a check out time; staff still edit that in the roll call when someone leaves early.
