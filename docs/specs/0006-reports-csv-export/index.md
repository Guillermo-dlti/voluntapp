# 0006. Reports and CSV export

**Date**: 2026-10-13
**Status**: Accepted

Decision history (context, options, rationale): [`rationale.md`](rationale.md). Verify steps: [`verify.md`](verify.md).

## Summary

Admins and coordinators get a Reportes tab that shows, for a chosen date range, three things: summary totals (hours, volunteers who took part, activities held), hours per volunteer, and attendance per activity. Every number comes only from finalized attendance, so a report never shifts after it is read. Each of the two lists can be exported as a CSV file that the server builds (with only names and numbers, no contact data), guarded against spreadsheet formula injection, rate limited, and written to the audit log. On the phone staff can download the file into a folder they pick, or share it through the Android share sheet (Drive, Gmail, WhatsApp).

## Requirements

**User stories**:
- As a coordinator or admin, I want to pick a period (this month, last month, this year, or custom dates) and see the official totals, so I can answer "how many hours did volunteers give" in seconds.
- As a coordinator or admin, I want to see hours per volunteer, including who gave none, so I can thank the most active and follow up with the inactive.
- As a coordinator or admin, I want to see attendance per finalized activity, so I can see which activities had good turnout.
- As a coordinator or admin, I want to export either list as a CSV and share it from my phone, so I can send it to leadership or open it in Excel.
- As an admin, I want every export recorded, so I can see who took data out and when.

**Acceptance criteria**:
- **AC-1**: The range is two dates `from` and `to` (`YYYY-MM-DD`, Guadalajara calendar days, both inclusive). An activity is in range when its `startsAt` falls between `from` at 00:00 and the day after `to` at 00:00, Guadalajara time. A date is valid only if it matches `YYYY-MM-DD` and survives a round trip (so `2026-02-30` is rejected). `from` after `to`, an invalid date, or a range longer than 366 days answers 400 with a plain Spanish message (and `fields`); the app validates the same rules before sending. Presets in the app: "Este mes" (default), "Mes pasado", "Este año" (1 January to 31 December), and "Personalizado" (two date fields).
- **AC-2**: Only finalized attendance counts. A record counts when its activity is in range and has `attendanceFinalizedAt` set and the record has `finalized: true`. Records of unfinalized activities, cancelled activities, and drafts never appear in any number.
- **AC-3**: Summary (`GET /api/reports/summary`) returns for the range: `totalHours` (sum of counted hours, rounded to 2 decimals), `volunteersParticipated` (distinct volunteers with at least one counted `present` or `late` record), `activitiesHeld` (finalized activities in range), and `pendingActivities` (activities in range that are `open` or `closed`, have started, and are not finalized). The app shows the first three as stat cards and, when `pendingActivities > 0`, one line saying how many activities in the period are not finalized yet and so are not counted.
- **AC-4**: Hours per volunteer (`GET /api/reports/volunteer-hours`) has one row for every `active` volunteer (zeros included) plus every `inactive` volunteer with at least one counted record in the range. Each row: volunteer id, first name, last name, status, `hours` (sum, 2 decimals), `completedActivities` (counted `present` or `late`), `lateCount`, `absentCount`. Sorted by hours descending, then last name, then first name (compared with `Intl.Collator('es-MX', { sensitivity: 'base' })`, so accents and case don't scramble the order), then `_id`, so paging is stable. Paged with `offset` and `limit` (default and maximum 50), returning `total`. For a range covering all of a volunteer's activities, `hours` and `completedActivities` equal the totals on the volunteer detail screen (spec 0003).
- **AC-5**: Attendance per activity (`GET /api/reports/activity-attendance`) has one row per finalized activity in range: activity id, name, location, `startsAt`, `endsAt`, `recordCount` (finalized records counted, which after finalizing equals the assigned people; named so it is not confused with `activities.assignedCount`), `presentCount`, `lateCount`, `absentCount`, `totalHours` (2 decimals), `attendanceFinalizedAt`. Sorted by `startsAt` descending, then name, then `_id`. Paged like AC-4.
- **AC-6**: Each list exports as CSV (`GET /api/reports/volunteer-hours.csv`, `GET /api/reports/activity-attendance.csv`) with every row for the range (no paging), the same rows and order as the JSON list. The file is UTF-8 with a byte order mark, comma separated, CRLF line endings, a Spanish header row, every text cell quoted (inner quotes doubled), dates as `dd/mm/aaaa HH:mm` in Guadalajara time, hours with a dot decimal and 2 places, counts as plain integers, `ID` as the 24 character hex id. Comma separator and dot decimal match Mexico's regional settings, so the file opens in columns in es-MX Excel. The volunteer file has no email, phone, birth date, emergency contact, or notes. The response is `text/csv; charset=utf-8`, `Content-Disposition: attachment` with a file name like `reporte-horas-voluntarios-2026-10-01_2026-10-31.csv` or `reporte-asistencia-actividades-…csv`, and `Cache-Control: no-store`. An empty range still returns a file with just the header row. The file name is built only from the validated `from`/`to` strings, so it cannot inject into the header.
- **AC-7**: Formula injection is neutralized: any text cell whose first character is `=`, `+`, `-`, `@`, a tab, or a carriage return is written with a leading single quote (`'`), so Excel shows it as text. Numbers and dates the server formats itself are written as is.
- **AC-8**: Every CSV export builds the whole file in memory first (a failed query answers 500 with nothing audited), then writes one `audit_log` entry, then sends the file. The entry: `action: 'export'`, `collection: 'reports'`, `actorId`, and `after: { report: 'volunteer-hours' | 'activity-attendance', from, to, rowCount }`, no `recordId`, and no row contents. If the audit write fails, no file is sent (500 with a plain message). The server log gets `report_exported` with the staff id, report name, and row count only.
- **AC-9**: Exports are rate limited to 20 per 15 minutes per staff member (both CSV routes together). The limiter is mounted after `requireStaff` and keyed by staff id (a custom `keyGenerator`), with `skipFailedRequests` so a 400 or 500 does not use up an export. Going over answers 429 as JSON `{ message }` with "Hiciste demasiadas exportaciones seguidas. Espera unos minutos e inténtalo de nuevo." The JSON report routes are not rate limited beyond the app's general behavior.
- **AC-10**: Every report and export route requires a session (401 without) and the `reports.view` capability: supervisors get 403 on all of them. The app hides the Reportes tab from supervisors (already true since feature 1).
- **AC-11**: In the app, the Reportes tab shows the range picker, the summary cards, and a preview of each list (the first 5 rows) with "Ver todos" opening a full list screen that loads 50 rows at a time as the user scrolls. Tapping a volunteer row opens the existing volunteer detail; tapping an activity row opens the existing activity detail. An empty period shows an `EmptyState` that says no finalized activities fall in the period.
- **AC-12**: Each list screen has two buttons side by side, "Descargar" and "Compartir", both disabled when the list's `total` is 0 and each showing progress while it works. Both fetch the CSV with the session token using `fetch` (so the status and the JSON error body can be read), not a download helper that may throw without the status, and add the byte order mark back if the phone's HTTP client dropped it. **Descargar** first opens Android's folder picker (`Directory.pickDirectoryAsync` from `expo-file-system`, starting at Download) and only then fetches the file, so closing the picker does nothing: no request, no export, no audit entry, no message. Android 11 and later refuse the Download folder itself in this picker, so staff pick or create a folder inside it (such as "Reportes BAMX"); the picker offers "Create new folder". The file is written with `createFile(name, 'text/csv')`; an existing file with the same name is kept and Android saves the new one as "… (1).csv". On success the screen says "Listo. Guardamos el archivo CSV en la carpeta que elegiste." **Compartir** writes the file to the app's cache with the SDK 57 `File` API and opens the Android share sheet; on Android `shareAsync` returns when the person comes back to the app from the app they shared to (checked on the emulator with Gmail), so the cached file is deleted in a `finally` after it returns, and any older report files left in the cache are removed at the start of the next share. On failure (no connection, 403, 429, 500, a folder that can't be written) the user sees a plain Spanish sentence, never a raw error; on a 401 the app signs out (`refresh()`).

## Decision

**Chosen option**: Option 2: Server aggregation at read time, one query function per report shared by JSON and CSV.

Reports are computed on demand on the server from finalized attendance, and the CSV routes reuse the exact same query functions, adding formatting, the audit entry, and a per staff rate limit.

Decisions made while writing this spec (the engineer did not weigh in on these):
- **Capability**: exports reuse `reports.view` (the `AGENTS.md` table has one row for "View reports / export CSV"); no new capability. Runner up: a separate `reports.export`, worth adding only if BAMX ever wants viewers who can't export.
- **Range anchor**: an activity belongs to the day its `startsAt` falls on in Guadalajara (activities can cross midnight; counting by start keeps each activity in exactly one period). Runner up: anchoring on `attendanceFinalizedAt`, which would put a late finalized activity in the wrong month.
- **Paging**: `offset`/`limit` rather than a cursor. Report data only changes when something is finalized or corrected, and lists are short, so the usual offset drift risk is negligible. Runner up: a keyset cursor on (hours, name), which is awkward for a computed sort key.
- **Volunteer list merge**: aggregate counted records grouped by `volunteerId`, read the candidate volunteers (active, plus inactive ids that appear in the aggregation) with only `firstName`, `lastName`, `status`, merge and sort in memory, then slice. Runner up: one big `$lookup` pipeline from `volunteers`, which is harder to read and no faster at this size.
- **CSV building**: hand written (about 30 lines: quote, double quotes, injection prefix, join with commas and CRLF). Runner up: the `csv-stringify` package; not worth a dependency for two fixed tables, and the injection rule has to be written by hand either way.
- **Audit order**: audit first, then send. If the response then fails to reach the phone, the log says an export happened that the user didn't receive, which is the safe direction for an audit trail. Runner up: audit after sending, which could miss real exports.
- **Rate limit key**: the staff id from the session (set by `requireStaff`), using `express-rate-limit` already in the server; in memory store, so the counter resets on a server restart. Acceptable for a single API instance.
- **App delivery**: `expo-file-system` (SDK 57 `File`/`Paths` API) downloads to `Paths.cache` with the `Authorization` header, `expo-sharing` opens the share sheet with `mimeType: 'text/csv'`, and `Directory.pickDirectoryAsync` (same module, Android's Storage Access Framework, no storage permission) gives the download folder. Install both with `npx expo install` so the versions match SDK 57; both are native modules, so the Android dev build must be rebuilt (`npm run android`). Check the v57 docs for the exact download call before writing it.
- **Download** (added 2026-10-13, after the first build, at the engineer's request): a "Descargar" button that saves to a folder staff pick with the system folder picker, beside "Compartir". Picked over always saving straight to Descargas (Android only allows that through MediaStore, which `expo-file-system` doesn't expose, so it needs an extra native module, and the file would sit in shared storage with no choice) and over keeping share only (Android's share sheet often has no "save to phone" target). Details in `rationale.md`.
- **Screens**: `src/app/(tabs)/reportes/` becomes a stack (like `voluntarios/`): `index` (range, summary, two previews), `voluntarios` and `actividades` (full lists with export). The range travels between screens as `from` and `to` route params.

## Feature design

**Data model sketch**:

No new collections, fields, or indexes. Reports read:

| Collection | Fields read | How |
|---|---|---|
| `activities` | `_id`, `name`, `location`, `startsAt`, `endsAt`, `status`, `attendanceFinalizedAt` | match `startsAt` in range; finalized = `attendanceFinalizedAt` exists. The existing index `activities_status_starts` (`status`, `startsAt`) serves the match with `status` in (`open`, `closed`). |
| `assignments` | `_id`, `volunteerId`, `activityId` | `$lookup` by `activityId` (index `assignments_activity_status`) |
| `attendance` | `assignmentId`, `status`, `hours`, `finalized` | `$lookup` by `assignmentId` (unique index), keep `finalized: true` |
| `volunteers` | `_id`, `firstName`, `lastName`, `status` | active volunteers (index `volunteers_status_name`) plus inactive ids from the aggregation |
| `audit_log` | writes one entry per export | `writeAudit()` |

Assignment status is not filtered: a finalized record can only belong to an `assigned` assignment (spec 0005, AC-7 refuses cancelling an assignment with a record), so counting records is enough.

**State transitions**: none. Reports are read only.

**API surface** (all under `/api/reports`, all `requireStaff(staffUsers, 'reports.view')`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/summary` | GET | `from`: date (req), `to`: date (req) | `totalHours`, `volunteersParticipated`, `activitiesHeld`, `pendingActivities` | session + `reports.view` | 400 bad range, 401, 403 |
| `/volunteer-hours` | GET | `from`, `to` (req), `offset`: int ≥ 0 (opt, 0), `limit`: 1 to 50 (opt, 50) | `rows[]` (`volunteerId`, `firstName`, `lastName`, `status`, `hours`, `completedActivities`, `lateCount`, `absentCount`), `total` | session + `reports.view` | 400, 401, 403 |
| `/activity-attendance` | GET | `from`, `to` (req), `offset`, `limit` (opt) | `rows[]` (`activityId`, `name`, `location`, `startsAt`, `endsAt`, `recordCount`, `presentCount`, `lateCount`, `absentCount`, `totalHours`, `attendanceFinalizedAt`), `total` | session + `reports.view` | 400, 401, 403 |
| `/volunteer-hours.csv` | GET | `from`, `to` (req) | CSV file | session + `reports.view`, export rate limit | 400, 401, 403, 429, 500 if the audit write fails |
| `/activity-attendance.csv` | GET | `from`, `to` (req) | CSV file | session + `reports.view`, export rate limit | 400, 401, 403, 429, 500 |

Query params are validated with one zod schema (`rangeSchema`, strict: unknown params are a 400) shared by all five routes. Dates in JSON are ISO strings (UTC), as in the other routes.

CSV columns:
- Volunteer hours: `ID`, `Nombre`, `Apellidos`, `Estado` (`Activo`/`Inactivo`), `Horas`, `Actividades completadas`, `Retardos`, `Faltas`.
- Activity attendance: `ID`, `Actividad`, `Lugar`, `Inicio`, `Fin`, `Asignados`, `Presentes`, `Retardos`, `Faltas`, `Horas totales`, `Finalizada el`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| any report | range start and end instants | `from`/`to` params converted from Guadalajara midnight to UTC with the `Intl` offset for `America/Mexico_City`, never a fixed −6 (a new helper in `server/src/common.ts`; `to` + 1 is a calendar day added before converting). `activities.ts` and `volunteers.ts` each declare their own `timeZone` constant today; the helper can export one for both |
| any report | "has started" for pending | `startsAt < now`, server clock |
| summary | `totalHours` | sum of `attendance.hours` of counted records, rounded to 2 decimals after summing |
| summary | `volunteersParticipated` | distinct `assignments.volunteerId` over counted records with status `present` or `late` |
| summary | `activitiesHeld` | count of activities in range with `attendanceFinalizedAt` set |
| summary | `pendingActivities` | count of activities in range, `status` in (`open`, `closed`), `startsAt < now`, no `attendanceFinalizedAt` |
| volunteer hours | row set | active volunteers ∪ volunteers with a counted record in range |
| volunteer hours | `hours`, `completedActivities`, `lateCount`, `absentCount` | grouped counted records per `volunteerId`; zero when the volunteer has none |
| activity attendance | `recordCount`, counts, `totalHours` | counted records grouped per activity |
| activity attendance | `attendanceFinalizedAt` | `activities.attendanceFinalizedAt` |
| CSV | file name | report slug + `from` + `to` params |
| app, Descargar | destination folder | the folder staff pick in Android's folder picker (opens at Download) |
| CSV | date cells | `startsAt`/`endsAt`/`attendanceFinalizedAt` formatted `dd/mm/aaaa HH:mm` in `America/Mexico_City` |
| CSV | `Estado` | `volunteers.status` mapped to `Activo`/`Inactivo` |
| export audit | `actorId` | the session's staff id (`requireStaff`) |
| export audit | `rowCount` | length of the rows written |
| export rate limit | key | the session's staff id |
| app | preset ranges | computed on the phone from `todayInMexico()` in `src/utils/time.ts`; the server only receives the `from`/`to` strings, so the phone's clock is trusted for presets |
| app | preview rows | the first page (`limit=5`) of each list endpoint |

**Key invariants**:
- Only records with `finalized: true` on activities with `attendanceFinalizedAt` set are counted, everywhere.
- The JSON list and the CSV for the same report and range contain the same rows in the same order (same query function).
- With a range that covers all of a volunteer's activities, report hours equal the volunteer detail total.
- No report or export ever writes anything except the one export audit entry.
- No CSV cell that started as text begins with `=`, `+`, `-`, `@`, tab, or CR.
- The volunteer CSV contains no contact data or notes.

**Security model**:
- `reports.view` (admin, coordinator) on every route, checked on the server with `requireStaff`; supervisors get 403 even though they can read the underlying activities and volunteers.
- Each export is audited (`action: 'export'`) before the file is sent, and the audit entry holds no personal data.
- Exports are rate limited per staff member.
- Server logs carry only ids, the report name, and counts; never names, query strings with personal data, or file contents.
- The app writes the CSV outside its private cache only where staff explicitly send it: a folder they pick in the system picker (Descargar) or an app they pick in the share sheet (Compartir). The app gets access to just that one folder, through Android's Storage Access Framework, with no storage permission. The shared copy in the cache is deleted after sharing. Once downloaded or shared, the file is outside BAMX's control and readable by whatever can read that folder or app; that is why it carries only names and numbers, and why every export is audited.
- Cancelling the folder picker happens before any request, so it never counts as an export.
- Personal data in scope: volunteer names (in the file) under Mexico's personal data law for private parties (LFPDPPP); minimizing columns is the control.

**Configuration required**: none (no new env vars). New app dependencies: `expo-file-system`, `expo-sharing` (via `npx expo install`).

**Critical test scenarios**:
- Happy path: finalize an activity with 3 present and 1 absent in this month, then the summary shows its hours, the volunteer list shows the 3 with hours and the absent one with `absentCount: 1`, the activity list shows the counts, and both CSVs download to a picked folder and open the share sheet, verifies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-12**
- Finalized only: an activity with recorded but unfinalized attendance does not change any number and raises `pendingActivities` by 1, verifies **AC-2**, **AC-3**
- Zeros and inactive: an active volunteer with no records appears with 0; an inactive one with hours in range appears; an inactive one with none does not, verifies **AC-4**
- Consistency: with an all time range, a volunteer's report hours equal their detail screen total, verifies **AC-4**
- Range edges: an activity starting at 23:30 Guadalajara on the last day is in; one at 00:00 the day after is out; a 367 day range is 400, verifies **AC-1**
- Injection: an activity named `=HYPERLINK("http://x")` exports as `'=HYPERLINK(...)`, verifies **AC-7**
- Audit: each export adds exactly one `export` entry with report, range, and row count and no names, verifies **AC-8**
- Rate limit: the 21st export within 15 minutes answers 429 with the Spanish message, verifies **AC-9**
- Auth/permission: supervisor gets 403 on all five routes; no session gets 401, verifies **AC-10**

## Build plan

Ordered as a tracer bullet (the project's approach in `scope.md`): first one thin path from range to summary on the phone, then each list end to end including its export.

1. Server: `rangeSchema` (zod, `from`/`to`, max 366 days, `offset`/`limit`) and the Guadalajara day to UTC helper in `server/src/common.ts`; `server/src/reports.ts` router mounted at `/api/reports` with `requireStaff(staffUsers, 'reports.view')`, satisfies **AC-1**, **AC-10**
2. Server: `summary` query function and `GET /summary`, satisfies **AC-2**, **AC-3**
3. App: turn `src/app/(tabs)/reportes.tsx` into the `reportes/` stack; `index` with preset chips (`FilterChips`), custom `DateField`s with the same range validation, and the summary `StatCard`s plus the pending line and `EmptyState`, satisfies **AC-1**, **AC-3**, **AC-11**
4. Server: `volunteerHours` query function (aggregate, merge with candidate volunteers, sort with Spanish collation, page) and `GET /volunteer-hours`, satisfies **AC-2**, **AC-4**
5. App: volunteer preview on `index` and the `reportes/voluntarios` list screen (paged `FlatList`, row opens volunteer detail), satisfies **AC-4**, **AC-11**
6. Server: CSV writer (quoting, injection prefix, BOM, CRLF, `es-MX` date format), export rate limiter keyed by staff id, and `GET /volunteer-hours.csv` that audits before sending, satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**
7. App: install `expo-file-system` and `expo-sharing`, rebuild the dev build; shared `exportCsv()` in `src/services/` (download with the token, share, delete, plain errors, sign out on 401) and the export buttons on the volunteer list screen ("Compartir" first; "Descargar" with the folder picker added after the first build), satisfies **AC-12**
8. Server: `activityAttendance` query function, `GET /activity-attendance` and `GET /activity-attendance.csv` (reusing steps 6's writer and limiter), satisfies **AC-2**, **AC-5**, **AC-6**, **AC-7**, **AC-8**
9. App: activity preview on `index` and the `reportes/actividades` list screen with export, row opens activity detail, satisfies **AC-5**, **AC-11**, **AC-12**
10. Verify: API checks for every AC against Atlas (including range edges, injection, audit entries, 429, supervisor 403), then the full flow on the Android emulator as coordinator (export and share both files) and as supervisor (no tab), satisfies **AC-1** to **AC-12**

## Consequences

**Positive**:
- Step 9 of the MVP demo flow works end to end.
- Reports, CSVs, and the volunteer detail all follow one counting rule, so they always agree.
- Exports are role checked, audited, rate limited, and injection safe on the server, which is what the security grade asks for.

**Negative / tradeoffs**:
- Hours given in activities that nobody finalized are invisible in reports until someone finalizes them; the pending line is the only hint.
- Every report request aggregates from scratch. Fine for BAMX's size; a much larger dataset would need indexes on the lookups or rollups.
- The volunteer list reads every active volunteer's name on each request (to include zeros); a few thousand names is fine, tens of thousands would want paging inside the database.
- The rate limit counter lives in memory, so restarting the server resets it, and it would not be shared across several API instances.
- The summary and the two lists are separate requests, so a finalize landing between them can make them disagree for a moment; a refresh fixes it.
- Two new native modules mean everyone must rebuild their Android dev build after pulling.
- Once downloaded or shared, a CSV is outside BAMX's control; minimization limits the damage but cannot prevent it.
- Android won't let staff save straight into Descargas; the first download asks them to create a folder inside it, which is one extra step.

**Neutral**:
- `src/app/(tabs)/reportes.tsx` becomes a folder with its own stack layout, like `voluntarios/` and `actividades/`.
- The first `export` entries appear in `audit_log`; the admin audit viewer (feature 7) should show them.

## Follow-up

- [ ] Feature 7's audit log viewer should show `export` entries with their report and range in plain words.
- [ ] Feature 8 (Hardening): automated tests for supervisor 403 on all report routes, the 429 limit, and the injection guard.
- [ ] If BAMX wants per activity rosters (one line per volunteer per activity), add a participation detail report then; it was left out of this feature on purpose.
