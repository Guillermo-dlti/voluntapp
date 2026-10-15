# 0009. QR check in for volunteers

**Date**: 2026-10-15
**Status**: In Progress

Decision history (context, options, rationale) is in [rationale.md](rationale.md); verify steps in [verify.md](verify.md).

## Summary

Every volunteer gets a random code (a "check in token") that the app draws as a QR on the volunteer's detail screen. On an activity's Asistencia tab, staff tap "Escanear", point the phone camera at the volunteer's QR, and the app marks that volunteer present (or late) with a check in time. The QR holds only the random code, never a name or a database id, and every scan goes through the same attendance rules, permissions and audit log as the roll call. The feature is built so it can be demoed in Expo Go on a real phone, with a demo activity seeded on the laptop.

## Requirements

**User stories**:
- As a coordinator or the activity's supervisor, I want to scan each volunteer's QR at the door so attendance is taken as people arrive, without searching the list.
- As any staff member, I want to open a volunteer's QR on their detail screen so I can show or screenshot it for them.
- As an admin or coordinator, I want to replace a volunteer's QR when a card is lost, so the old one stops working.
- As the team, we want a one command demo setup so we can show scanning on a real phone from QRs on the laptop screen.

**Acceptance criteria**:
- **AC-1**: Every volunteer created through `POST /api/volunteers` or the demo seeds gets a `checkinToken` of 24 random bytes in base64url (32 characters, `^[A-Za-z0-9_-]{32}$`), unique across volunteers. The QR encodes only that token. The token never appears in volunteer list responses, server logs, or `audit_log` snapshots.
- **AC-2**: `GET /api/volunteers/:id` returns `checkinToken` to every role with `volunteers.read` (admin, coordinator, supervisor), and the detail screen shows it as a QR. A volunteer without a token (not yet backfilled) shows "Este voluntario aún no tiene código QR." plus, for admin and coordinator, a "Generar código" button.
- **AC-3**: `npm run server:backfill:checkin -- --actor <email>` gives a token to every volunteer that has none, writes one `update` audit entry per volunteer with that active admin as actor, touches nobody else, and does nothing on a second run.
- **AC-4**: Admin and coordinator can regenerate a volunteer's QR (`POST /api/volunteers/:id/checkin-token`) after a confirmation that says the old code stops working. The old token then scans as "Código no válido". The change writes an `update` audit entry whose snapshots show `checkinTokenIssuedAt` changing but no token. A supervisor gets 403 and sees no button.
- **AC-5**: A scan of an assigned, active volunteer's token on an activity whose attendance is open creates one attendance record: `checkInAt` = the scan time, raised to `startsAt` when earlier; `checkOutAt` = `endsAt`; `hours` = `endsAt − checkInAt` rounded to 2 decimals; `status` = `late` when the scan is more than 15 minutes after `startsAt`, else `present`; `method` = `qr`; `recordedBy` = the scanning staff member. It writes an `insert` audit entry in the same transaction and answers 201 with `outcome: 'checked_in'`, the volunteer's full name, the stored status, and the activity's counts. The scanner shows a green banner ("Ana Sofía Ramírez Ortega · Presente", or "· Llegó tarde").
- **AC-6**: A scan of a volunteer who already has an attendance record for that assignment (any status, recorded by hand or by scan) changes nothing, writes no audit entry, and answers 200 with `outcome: 'already'`, the name and the current status. The scanner shows an amber banner ("Ya registrado · Falta").
- **AC-7**: A scan of a known token whose volunteer has no `assigned` assignment on that activity (never assigned, or cancelled) answers 409 with `outcome: 'not_assigned'` and the name; red banner "Ana Sofía Ramírez Ortega no tiene lugar en esta actividad." (gender neutral on purpose).
- **AC-8**: A scan of an assigned volunteer whose status is `inactive` answers 409 with `outcome: 'inactive'` and the name; red banner telling staff to reactivate the volunteer first. Nothing is written.
- **AC-9**: An unknown token, or a body token that fails the pattern, answers 404 with `outcome: 'invalid'` and "Código no válido". On the phone, a QR whose text doesn't match the token pattern shows the same red banner without calling the API.
- **AC-10**: Activity level refusals reuse the attendance gate and its messages: draft, cancelled, finalized, not started and not opened early (409), another supervisor's activity (403), unknown activity (404). A scan after `endsAt` answers 409 "La actividad ya terminó. Registra la asistencia en la lista." Admin and coordinator may scan on any activity; a supervisor only on activities where they are `supervisorId`.
- **AC-11**: The check in endpoint is rate limited per staff member to 60 requests a minute; over the limit it answers 429 with a plain Spanish message, shown as a red banner.
- **AC-12**: Two phones scanning the same card at the same moment produce exactly one attendance record; the other gets `already`. No request answers 500.
- **AC-13**: The Asistencia tab shows a secondary "Escanear" button only to staff who may record attendance on that activity, only while its attendance is open, not finalized and `endsAt` hasn't passed. It opens a full screen scanner that: asks for camera permission (with an explanation and "Permitir cámara"; when denied for good, "Abrir ajustes"); reads QR codes only; ignores the same code for 3 seconds after reading it and reads nothing while a request is in flight; stays on the camera after every result; shows "12 de 20 registrados" from the last response; has a torch toggle and a close button; on no connection or a timeout shows a red "No hay conexión. Vuelve a escanear." and forgets that code so a retry works. Closing returns to the roll call, which reloads and shows the new records, each scanned one with a small "QR" note.
- **AC-14**: The roll call record (`PUT`), "Marcar todos presentes" and the admin correction store `method: 'manual'`. Records without `method` read as manual.
- **AC-15**: The demo runs in Expo Go SDK 57 on a phone on the same Wi‑Fi as the laptop: the API listens on `0.0.0.0` when `HOST=0.0.0.0`, the app uses `EXPO_PUBLIC_API_URL=http://<laptop LAN IP>:3000`, and `server/README.md` explains both plus `npx expo start --go -c`. `npm run server:seed:qr` (non destructive) creates or reuses a "Demo · Escaneo de QR" activity starting in 10 minutes with attendance already started, supervised by `supervisor@bamx.test`, with 4 assigned active volunteers, and writes a gitignored `server/demo-qr.html` with their 4 QRs, 1 active volunteer who is not assigned, and 1 well formed fake code.

## Decision

**Chosen option**: Option 1: random token per volunteer, resolved on the server inside the attendance router.

Volunteers get a stored random `checkinToken`; scanning posts it to `POST /api/activities/:id/attendance/check-in`, which applies every attendance rule server side in one transaction. The app draws QRs with `react-native-qrcode-svg` (on `react-native-svg`) and scans with `expo-camera`'s `CameraView`, all of which run in Expo Go.

## Feature design

**Data model sketch**:

| Collection | Field | Type | Rules |
|---|---|---|---|
| `volunteers` | `checkinToken` | string, optional in the validator | `^[A-Za-z0-9_-]{32}$`; unique partial index `volunteers_checkin_token_unique` on `{ checkinToken: 1 }` with `partialFilterExpression: { checkinToken: { $type: 'string' } }`. Always set by the API on create. |
| `volunteers` | `checkinTokenIssuedAt` | date, optional | Set whenever a token is issued (create, backfill, regenerate). This is what the audit snapshots show change. |
| `attendance` | `method` | `'qr'` \| `'manual'`, optional | Source of the last write. Missing reads as `manual`. |

Note: the field agreed in the conversation as `checkinTokenRotatedAt` is named `checkinTokenIssuedAt` here, because the create and backfill paths also need a visible audit change and they aren't rotations.

Relationships are unchanged: a token maps to exactly one volunteer; that volunteer has at most one assignment per activity (existing unique index), and an assignment at most one attendance record (existing unique index).

`checkinToken` is added to the audit writer's `secretFields` in `server/src/audit.ts`, next to `assignmentLock`. `publicVolunteer()` gains `checkinToken` (null when missing) and is used only by detail, create, edit, status and regenerate responses; the list endpoint keeps its own projection without it.

**State transitions**: none new. A scan only ever creates an attendance record; it never moves an existing one.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/activities/:id/attendance/check-in` | POST | `token: string` (req, strict object) | `outcome`, `message`, `volunteer: { name } \| null`, `attendance: { status, checkInAt } \| null`, `counts: { recorded, assigned }` | session + `attendance.record` + own activity for supervisors; 60/min per staff | 201 `checked_in`; 200 `already`; 404 `invalid`; 409 `not_assigned` / `inactive`; 409 gate refusals and ended; 403 not owner; 404 activity; 429 |
| `/api/volunteers/:id/checkin-token` | POST | none | `{ volunteer }` with the new `checkinToken` | session + `volunteers.write` | 404 unknown volunteer, 403 supervisor |
| `/api/volunteers/:id` | GET (changed) | none | adds `checkinToken: string \| null` | session + `volunteers.read` | unchanged |
| `/api/activities/:id/attendance/*` record, mark all, correct | (changed) | none new | `attendance.method` in `publicAttendance()` | unchanged | unchanged |

Check in order of checks, inside one transaction: parse activity id (404) → zod `{ token }` (pattern failure answers the `invalid` 404, not a 400, so a junk QR reads the same as an unknown one) → `loadActivity` (404, 403) → `stampOpen` (409 with the existing refusal messages) → `now > endsAt` (409 ended) → find volunteer by token (404 `invalid`) → find `{ volunteerId, activityId, status: 'assigned' }` (409 `not_assigned`) → volunteer `inactive` (409 `inactive`) → existing attendance for the assignment (200 `already`) → insert via `attendanceValues({ status, checkInAt, checkOutAt })` plus `method: 'qr'`, audit `insert` (201). Counts are read in the same transaction after the write.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Create volunteer | `checkinToken` | `newCheckinToken()` in `server/src/checkin-token.ts`: `randomBytes(24).toString('base64url')` |
| Create, backfill, regenerate | `checkinTokenIssuedAt` | server clock at the write |
| Backfill | audit `actorId` | `--actor <email>` argument, must be an active admin in `staff_users` |
| Check in | activity | route param `:id` |
| Check in | volunteer | `volunteers.findOne({ checkinToken: body.token })` |
| Check in | assignment | `assignments.findOne({ volunteerId, activityId, status: 'assigned' })` |
| Check in | `checkInAt` | `max(now, activity.startsAt)` |
| Check in | `checkOutAt` | `activity.endsAt` |
| Check in | `hours` | `attendanceValues()` default for present or late with both times (span, rounded to 2 decimals) |
| Check in | `status` | `late` when `now > startsAt + 15 min` (constant `LATE_AFTER_MINUTES = 15` in `attendance.ts`), else `present` |
| Check in | `volunteer.name` | `${firstName} ${lastName}` from the volunteer document |
| Check in | `counts.assigned` | `activity.assignedCount` |
| Check in | `counts.recorded` | count of attendance records whose `assignmentId` is in the activity's `assigned` assignments (same query the finalize check uses) |
| `already` banner | current status | the existing attendance record |
| Scanner banner text | Spanish sentence | server `message` (the app only adds the tone from `outcome`) |
| Escanear button visibility | may record, opened, not finalized, not ended | `canOnActivity` mirror in the app plus `activityStep()` from `src/utils/activity-flow.ts` and `endsAt` from the activity detail |
| Demo seed | demo window | `startsAt = now + 10 min`, `endsAt = startsAt + 3 h`, `attendanceStartedAt = now` |
| Demo HTML | QR images | `qrcode` package (`toString(token, { type: 'svg' })`), server devDependency |

**Key invariants**:
- A QR contains only the token; no endpoint maps a token to a volunteer except the check in endpoint, and that one only inside a staff session with attendance rights on the activity.
- `checkinToken` is unique when present and never appears in list responses, logs or audit snapshots.
- A scan never updates or deletes an attendance record; at most it inserts one.
- Every scan record satisfies spec 0005: times inside the schedule, `checkOutAt > checkInAt`, hours not above the span.
- One record per assignment holds under concurrency: `stampOpen` writes the activity first, so concurrent scans on one activity collide and `withTransaction` retries the loser, which then sees the record and answers `already`; the unique index on `attendance.assignmentId` is the backstop.
- Every insert and regeneration writes its audit entry in the same transaction.

**Security model**:
- Read QR: admin, coordinator, supervisor (`volunteers.read`).
- Regenerate QR: admin, coordinator (`volunteers.write`).
- Scan: `attendance.record`; supervisors only on activities they supervise (`canOnActivity`).
- Rate limit: `express-rate-limit`, keyed by staff id like the CSV export limiter in `reports.ts`, 60 per minute, placed after `requireStaff`.
- Logs: `attendance_checkin` with `activityId`, `staffId`, `outcome` and `attendanceId` when created; `volunteer_checkin_token_issued` with `volunteerId` and `staffId`. Never the token or a name.
- The demo HTML holds names and working codes: written only by the seed, gitignored, and the seed prints a reminder to delete it after the demo.

**Configuration required**:
- No new variables. `HOST=0.0.0.0` (already accepted by `server/src/config.ts`) and `EXPO_PUBLIC_API_URL=http://<LAN IP>:3000` in the root `.env` for the phone demo; documented in `server/README.md`.
- `app.json`: `expo-camera` plugin with `cameraPermission: "VoluntApp usa la cámara para escanear tarjetas de voluntarios"` and `recordAudioAndroid: false`. Expo Go uses its own permission prompt, so the text only shows in a dev build or APK (and Android itself shows no custom text; it is the iOS usage string).
- New app dependencies through `npx expo install`: `expo-camera`, `react-native-svg`, `react-native-qrcode-svg`. New server devDependency: `qrcode` (+ `@types/qrcode`).

**App pieces**:
- `src/components/volunteer-qr-card.tsx`: `Card` with the QR on white with a quiet zone, a short caption, and for admin and coordinator a secondary "Generar nuevo código" behind a confirmation sheet; toast "Código nuevo listo".
- `src/app/escanear/[id].tsx`: full screen modal (registered in the root `Stack` with `presentation: 'fullScreenModal'`), `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`, `useCameraPermissions()`, `Linking.openSettings()` for a permanent denial, torch via `enableTorch`. Banner tones from theme tokens: green `primary`, amber `accent`, red `danger`. A pure helper `src/utils/checkin.ts` holds the token pattern and the debounce decision.
- `src/services/attendance.ts` (or the existing attendance service): `checkIn(activityId, token)` through `apiRequest()`; it must surface the `outcome` body on 404 and 409 instead of only the message.
- Roll call row: small "QR" caption when `method === 'qr'`.

**Critical test scenarios**:
- Happy path: coordinator scans 4 seeded cards; 4 green banners, count goes to 4 de 4, roll call shows 4 "QR" records with check in at `startsAt`, audit has 4 inserts with no token, verifies **AC-5**, **AC-13**, **AC-15**.
- Already: scan the same card again after 3 seconds; amber, no new audit entry, verifies **AC-6**.
- Refusals: unassigned volunteer (red, not assigned), fake code (red, no request when malformed, 404 when well formed), deactivated assigned volunteer (red), scan after `endsAt` (red ended), verifies **AC-7**, **AC-8**, **AC-9**, **AC-10**.
- Concurrency: two parallel check ins with one token on one activity give one 201 and one 200 and exactly one record, verifies **AC-12**.
- Revocation: regenerate, old QR scans invalid, new one works, audit shows `checkinTokenIssuedAt` changing, verifies **AC-4**.
- Auth/permission: supervisor scanning another supervisor's activity gets 403; no session gets 401; supervisor calling regenerate gets 403; 61st scan in a minute gets 429, verifies **AC-10**, **AC-11**, **AC-4**.
- Exposure: volunteer list responses, server logs and `audit_log` contain no `checkinToken`, verifies **AC-1**.

## Build plan

Ordered as thin end to end slices (the project's tracer bullet approach in `scope.md`): first a token you can see as a QR, then a scan that records, then the edges.

1. Server token foundation: `server/src/checkin-token.ts` (`newCheckinToken()`, pattern), validator fields and the unique partial index in `collections.ts`, `Volunteer` type, token issued in `POST /api/volunteers` and `seed-demo.ts`, `checkinToken` in `publicVolunteer()` but not in the list, `checkinToken` added to audit `secretFields`, satisfies **AC-1**, **AC-2**
2. App QR: `npx expo install react-native-svg react-native-qrcode-svg`, `VolunteerQrCard` on the volunteer detail with the no token state, satisfies **AC-2**
3. Check in endpoint in `attendance.ts` with the rate limiter, outcomes, counts and logs; `method` on attendance (validator, type, `publicAttendance`) and `'manual'` on the PUT, mark all and correct paths, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-14**
4. App scanner: `npx expo install expo-camera` plus the `app.json` plugin, `escanear/[id]` full screen modal with permission states, debounce, banner, count and torch; "Escanear" on the Asistencia tab; "QR" note in the roll call; `checkIn()` service call, satisfies **AC-9**, **AC-13**, **AC-14**
5. Regenerate: `POST /api/volunteers/:id/checkin-token` with audit, and the button with confirmation in `VolunteerQrCard`, satisfies **AC-4**, **AC-2**
6. Backfill script `server/src/backfill-checkin-tokens.ts` and `server:backfill:checkin` script, run once against Atlas, satisfies **AC-3**
7. Demo setup: `server/src/seed-qr-demo.ts` (non destructive, overlap safe volunteer choice, audit entries, `assignedCount` kept in step) writing `server/demo-qr.html` (gitignored), `server:seed:qr` script, `server/README.md` phone section, `npx expo install --fix` so Expo Go's native versions match, satisfies **AC-15**
8. Verify: API checks for every AC against Atlas (parallel scans for AC-12), then the flow on a real phone in Expo Go as coordinator and supervisor; `npm run typecheck` and `npm run lint`, satisfies **AC-1** to **AC-15**

## Consequences

**Positive**:
- Taking attendance at the door becomes one scan per person, with late arrivals recorded automatically.
- Scans go through the exact same gate, permissions and audit as the roll call, so no new way around the rules.
- Cards carry no personal data, and a lost card can be cancelled in two taps.

**Negative / tradeoffs**:
- Tokens are stored in plain form; anyone with database read access sees working codes. Mitigated by needing a staff session to use them and by regeneration; hashing would make the QR impossible to redraw.
- A scan can't record an early departure; hours always run to `endsAt` until staff edit the record.
- The 15 minute late threshold is a fixed constant, not a BAMX setting.
- Three new app dependencies and one server devDependency; `expo-camera` is a native module, so the dev build has to be rebuilt (`npm run android`) after pulling, as with `expo-file-system` in feature 6.
- Expo Go pins native versions: packages already out of date (`expo install --check`, scope 5b) must be aligned, and anything not shipped in Expo Go 57 (to check: `@expo/ui`, used by the date and time fields) would break in the demo outside the scan flow.
- The demo seed writes straight to the collections like `seed-demo.ts`, not through the service functions, so it has to repeat the overlap and counter rules itself.

**Neutral**:
- Existing volunteers need the one time backfill before their QRs show; until then the detail screen says so.
- `attendance.method` is new reporting data; reports ignore it for now.
- The scanner is the first root level modal route outside the tabs.

## Follow-up

- [ ] Decide whether BAMX wants printable cards (share the QR as an image or a PDF sheet per activity); out of scope here.
- [x] Confirm `@expo/ui` runs in Expo Go SDK 57: its Jetpack Compose dialogs are Android only, so iOS got its own picker sheet (`src/components/picker-dialog.ios.tsx`).
- [ ] Add the new endpoint to the Hardening role tests (feature 8): supervisor on another activity, no session, rate limit.
- [ ] Consider making the late threshold a setting if BAMX asks for it.
- [ ] Record in spec 0005 (via /architect) that attendance now has a second writer and a `method` field.
