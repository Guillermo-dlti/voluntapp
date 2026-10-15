# 0007. Guided activity flow, roll call attendance, and findable report exports

**Date**: 2026-10-13
**Status**: In Progress

## Summary

Staff find the activity screens hard to use: the detail screen is one long scroll that never says what to do next, attendance takes one form per person, and report downloads hide inside the "Ver todos" lists. This spec reorganizes those screens without changing any business rule. An activity now shows where it is in its life (borrador, publicada, asistencia, finalizada) and one button for the next step. Attendance becomes a roll call with one tap per person. The main Reportes screen shows a short summary you can read at a glance (the five volunteers with the most hours, and how attendance split between present, late and absent), with one download card that lets you pick the file. The API changes are small: a new "Por finalizar" filter on the activities list, and the attendance split added to the report summary.

## Requirements

**User stories**:
- As a coordinator, I want each activity to tell me its next step so that I don't have to remember the order (publish, assign, take attendance, finalize).
- As a coordinator or supervisor, I want to mark attendance with one tap per person so that a roll call of 15 people takes a minute, not 15 trips to a form.
- As a coordinator, I want to see which activities still need attendance finalized so that hours don't go uncounted.
- As an admin or coordinator, I want to see who gave the most hours and how attendance went right on Reportes, and download the full file from there, so that I don't have to open a list or a spreadsheet to answer the common questions.

**Acceptance criteria**:
- **AC-1**: The activity detail shows a progress strip with four steps (Borrador → Publicada → Asistencia → Finalizada), the current step highlighted, and below it one "next step" card whose text and button follow the table in *Next step rules*. A cancelled activity shows a "Actividad cancelada" card with no strip and no button.
- **AC-2**: Secondary actions (Editar, Volver a borrador, Cerrar inscripciones, Cancelar actividad) live in a "⋯" button in the header band, which opens a bottom action sheet listing only the actions that apply to the state and role (see *Overflow menu*). The "⋯" button is hidden when no action applies. Volver a borrador and Cancelar ask for confirmation; Cerrar inscripciones asks for confirmation with copy saying attendance can still be taken and finalized afterwards.
- **AC-3**: Below the card, three tabs: Detalles · Participantes · Asistencia. The screen opens on the default tab for the state (see *Default tab*), unless the route carries `tab=detalles|participantes|asistencia`, which wins. Coming back from Editar, Asignar or the attendance form keeps the tab the user was on.
- **AC-4**: Participantes shows the "X/Y asignados" stat, an "Asignar voluntario" button when assigning is allowed and there's room, each assigned person as a row with avatar, name and phone, a visible phone icon button that calls (`tel:`), and, only when the user can assign, a "⋯" icon button that opens an action sheet with "Cancelar asignación" (same reason dialog and rules as today). Cancelled people stay listed in a "Cancelados" section with their reason.
- **AC-5**: In Asistencia, when the user may record (see AC-9), each assigned person's row shows three buttons: Presente, Tarde, Falta. Tapping Presente or Falta saves at once (status only; the API fills in hours) and the row shows the saved status badge and hours. While a row saves, its buttons are disabled with a small spinner; other rows stay usable. If the save fails, the row keeps its previous state and shows a plain Spanish message under it.
- **AC-6**: Tapping Tarde opens the existing attendance form with Tarde already selected. Tapping a person's name opens the same form with their current record, for times or custom hours.
- **AC-7**: The Asistencia tab shows "X de Y registrados", a filter with "Todos" and "Sin registrar", and keeps "Marcar todos presentes" (existing endpoint, unchanged) as a secondary button while someone is unrecorded.
- **AC-8**: While the user may record, a bar fixed at the bottom of the screen holds "Finalizar asistencia". It is disabled with the line "Registra a todos para finalizar (faltan N)" until everyone is recorded; when enabled it asks for the same confirmation as today. After finalizing, the tab shows every row read only with badge and hours, the line "Asistencia finalizada el <fecha>", and the total hours counted.
- **AC-9**: Who sees what, unchanged from spec 0005: the roll call buttons and the finalize bar appear only when attendance is not finalized and `roleCan.recordAttendance(role, supervisorId, userId)` is true. Once finalized, an admin can tap a row to open the correction form; everyone else sees rows read only. Supervisors never see the "⋯" menu, Asignar, or cancel. The API checks are untouched.
- **AC-10**: In the Actividades list, each row adds one "next step" hint line (see *List hint*), and the filter chips become Próximas · Por finalizar · Pasadas · Canceladas · Todas. "Por finalizar" lists activities that started, are open or closed, and have no finalized attendance, oldest first, served by the API (`when=pending`), with its own empty state.
- **AC-11**: When the period has finalized activities, the main Reportes screen shows, after the stat cards, a "Resumen" section on one `Card` with two charts (see *Reportes summary*):
  - **Más horas**: up to five volunteers with the most hours in the period (only those with more than 0 h), one horizontal bar each, longest first, with the name and the hours in words ("12 h"). Tapping a row opens the volunteer.
  - **Asistencia**: one bar split into Presentes, Tarde and Faltas for every finalized record in the period, with a legend that names each status and gives its count and percent.

  Below it, a "Ver detalle" section with two rows, "Horas por voluntario" and "Asistencia por actividad", which open the existing full lists with their counts. The two 5 row previews are removed. The sub screens keep their Descargar and Compartir buttons.
- **AC-11b**: One card "Descargar reporte completo (CSV)" sits after the summary (and after the empty state when nothing is finalized). It shows the period and opens a bottom sheet in two steps: (1) "¿Qué archivo?" lists "Horas por voluntario" and "Asistencia por actividad", each with one line on what it holds and its row count; a file with 0 rows is shown disabled with "Sin filas en este periodo". (2) Tapping a file shows "Guardar en el teléfono" (the existing folder picker download) and "Compartir" (the existing share sheet). While the file is being made, the card button shows "Guardando…" or "Preparando…"; afterwards the success or error sentence shows on the card, under the button. When both files have 0 rows, the card button is disabled with "No hay filas que exportar en este periodo."
- **AC-12**: When a signed in user's background session check fails for a reason other than 401 (no connection, timeout), the app keeps the current screen and user instead of replacing it with the full screen error. So saving a report offline shows "No hay conexión…" on the download card. A 401 still signs out, and a failed check at app launch (no user yet) still shows the full screen error.
- **AC-13**: All new copy is Spanish, plain, and follows `AGENTS.md` → Design. Icon only buttons (phone, ⋯) have Spanish accessibility labels ("Llamar a <nombre>", "Más acciones") and touch targets of at least 48 dp. No raw error text reaches the screen.

## Decision

**Chosen option**: Option 2: Guided restructure of the existing screens, app side, with one small API filter.

Rebuild the activity detail around a computed "next step", turn attendance into an inline roll call that reuses the existing attendance endpoints, add a `when=pending` list filter, give the main Reportes screen a summary with two bar charts and one download card with a file picker sheet, and fix the offline session check. No schema change, no new business rule.

Small calls made here (pick, why, runner up):
- **Tabs** are a new shared `SegmentedTabs` in `src/components`, built in React Native like `FilterChips` (flat, 1px border, selected fill `primary`). Why: reliable layout inside the `Screen` scroll view; the Compose pickers already caused layout jumps there. Runner up: `@expo/ui` `SingleChoiceSegmentedButtonRow`.
- **Menus** (header "⋯" and the participant "⋯") are a new shared `ActionSheet` in `src/components`: a React Native `Modal` sliding from the bottom with a title, action rows (critical ones in `danger` color) and "Volver". Why: Android `Alert` shows at most three buttons and the header menu can need four plus Volver; same Compose layout risk as above. Runner up: `@expo/ui` `DropdownMenu`.
- **Fixed bottom bar**: `Screen` gets an optional `footer` prop rendered under the sheet, above the safe area, and the scroll content gets bottom padding for it. Why: one place for every future sticky action. Runner up: a one off absolute view in the detail screen.
- **Icon buttons**: a small shared `IconButton` (48 dp target, flat, 1px border) for phone and "⋯". Why: used in at least three places.
- **The flow logic** lives in one pure module `src/utils/activity-flow.ts` (`activityStep`, `nextStep`, `defaultTab`, `listHint`), so the detail screen, the list, and the dashboard (spec 0008) agree. Runner up: computing it inside each screen.
- **Roll call saves** are not optimistic: the row waits for the API answer and then shows it. Why: attendance becomes official hours; a row should never show a status the server refused. Runner up: optimistic update with rollback.
- **Pending definition** (`when=pending`): `status ∈ {open, closed}`, `startsAt ≤ now`, no `attendanceFinalizedAt`, sorted by `startsAt` ascending. Why: it is exactly the set the finalize endpoint accepts and what Reportes counts as pending, so the three never disagree.
- **Bars** are plain React Native `View`s with percent widths, in one new shared file `src/components/bar-chart.tsx` (`HorizontalBars` for Más horas, `StackedBar` for Asistencia). Why: two simple bars don't justify a chart library and a new native module (and a dev build rebuild). Runner up: `react-native-svg` with a chart library.
- **Attendance split** comes from the API: `GET /api/reports/summary` adds `presentCount`, `lateCount`, `absentCount`, computed in the same `countedRecords` aggregate as `totalHours`. Why: the app only has 5 preview rows, so adding them up would undercount, and the same counting rule keeps the chart equal to the CSV. Runner up: fetching every activity row to sum in the app.
- **Top five** reuse `GET /api/reports/volunteer-hours` with `limit=5`, already sorted by hours. Why: no new endpoint; same order as the file.
- **Download sheet** reuses `ActionSheet`, which gains two optional fields on `SheetAction`: `detail` (a second muted line) and `disabled`. The two steps are one `ActionSheet` whose title and actions follow a `step` state (`file`, or the chosen kind). "Volver" closes the sheet. Why: one sheet component in the app. Runner up: a separate `ReportSheet` component.
- **Export logic** moves out of `ExportActions` into a `useReportExport(range)` hook that exposes `busy`, `message` and `run(kind, 'download' | 'share')`, including the 401 sign out, so the download card and `ExportActions` share it. Why: one place for the folder picker, share and the result sentences.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no change. Every value comes from fields already in `activities`, `assignments` and `attendance` (spec 0004, 0005).

**State transitions**: unchanged on the server. The app derives a display step:

| Display step | Condition (from `ActivityDetail` and now) |
|---|---|
| Borrador | `status = draft` |
| Publicada | `status ∈ {open, closed}` and `startsAt > now` |
| Asistencia | `status ∈ {open, closed}`, `startsAt ≤ now`, `attendanceFinalizedAt = null` |
| Finalizada | `attendanceFinalizedAt ≠ null` |
| (Cancelada) | `status = cancelled`, shown as a card, not a strip step |

**Next step rules** (AC-1). `canEdit = roleCan.editActivities`, `canAssign = roleCan.assignVolunteers`, `canRecord` as in AC-9; `n` = assigned people, `r` = assigned people with a record.

| State | Card text | Button (only if allowed) |
|---|---|---|
| Borrador | "Publica la actividad para poder asignar voluntarios." | Publicar (`canEdit`) |
| Publicada, room left, open | "Empieza el <fecha>. Asignados X de Y." | Asignar voluntarios (`canAssign`) → `/actividades/[id]/asignar` |
| Publicada, full or closed | "Empieza el <fecha>. Cupo lleno." / "Inscripciones cerradas." | none |
| Asistencia, `n = 0` | "Nadie quedó asignado. Puedes cerrar las inscripciones desde ⋯." | none |
| Asistencia, `r < n` | "Toma la asistencia: r de n registrados." | Tomar asistencia (`canRecord`) → switches to Asistencia tab |
| Asistencia, `r = n` | "Todos registrados. Finaliza para que las horas cuenten." | Finalizar asistencia (`canRecord`) → same confirmation as AC-8 |
| Finalizada | "Asistencia finalizada. <H> h contadas." | none |
| Cancelada | "Actividad cancelada. Sus asignaciones se conservan." | none |

When the button is not allowed for the role, the card shows only the text (for example a supervisor on someone else's activity).

**Overflow menu** (AC-2), only for `canEdit`:

| Status | Actions |
|---|---|
| draft | Editar datos · Cancelar actividad |
| open | Editar datos · Volver a borrador (only when `assignedCount = 0`) · Cerrar inscripciones · Cancelar actividad |
| closed, cancelled | none (button hidden) |

Cerrar inscripciones confirmation: title "¿Cerrar inscripciones?", body "Ya no se podrá editar ni asignar a nadie. La asistencia se puede tomar y finalizar igual." Cancelar and Volver a borrador keep today's copy.

**Default tab** (AC-3): draft → Detalles; Publicada → Participantes; Asistencia or Finalizada → Asistencia; cancelled → Detalles. A `tab` route param overrides. The chosen tab is kept in screen state; returning from a pushed screen does not reset it (the reload on focus only refreshes data).

**List hint** (AC-10), one line on each row, computed from `ActivitySummary` and now:

| Condition | Hint | Tone |
|---|---|---|
| draft | "Borrador: falta publicar" | neutral |
| open, not started, room left | "Faltan N lugares" | neutral |
| open, not started, full | "Cupo lleno" | existing accent text |
| started, not finalized, not cancelled | "Asistencia por finalizar" | `accent` (needs attention) |
| finalized | "Asistencia finalizada" | neutral |
| cancelled | none (the badge says it) | |

**Reportes summary** (AC-11, AC-11b). Screen order: stat cards → Resumen → Descargar reporte completo (CSV) card → Ver detalle. With no finalized activity: empty state → download card (the volunteer file still lists active volunteers with 0 h).

| Piece | Rule |
|---|---|
| Más horas rows | `volunteers.rows` filtered to `hours > 0`, in API order (hours desc, then last name). 0 rows left: the chart shows "Nadie sumó horas en este periodo." |
| Más horas bar width | `hours / max(hours) × 100 %`, at least 4 dp so a small value still shows; color `primary`. Name on one line (truncated), "12 h" with `formatHours` at the end of the row. |
| Más horas a11y | each row is one button labeled "<nombre>, <horas> horas", opens `/voluntarios/[id]`; touch target at least 48 dp |
| Asistencia bar | segments in order Presentes · Tarde · Faltas, width `count / total × 100 %`, a 0 count segment is left out; colors from `attendanceTones` (`success`, `attention`, `critical`) so they match the roll call. `total = present + late + absent`; `total = 0` shows "Sin registros de asistencia en este periodo." |
| Asistencia legend | under the bar, one item per status, always in words: "Presentes 40 · 80 %", "Tarde 6 · 12 %", "Faltas 4 · 8 %". Percent rounded to whole numbers (they may not add to exactly 100; that's fine). The bar has one a11y label reading the whole legend. |
| Ver detalle | two `Row`s: "Horas por voluntario" (note: N voluntarios) → `/reportes/voluntarios`, "Asistencia por actividad" (note: N actividades) → `/reportes/actividades`, both with the period params as today |
| Download card | title "Descargar reporte completo (CSV)", period line (`rangeLabel`), one primary button "Elegir archivo"; busy labels "Guardando…" / "Preparando…"; result or error sentence under the button (same copy as `ExportActions` today) |
| Sheet step 1 | title "¿Qué archivo?", subtitle the period; rows "Horas por voluntario" (detail "Una fila por voluntario con sus horas · N filas") and "Asistencia por actividad" (detail "Una fila por actividad con presentes, retardos y faltas · N filas"); `disabled` with detail "Sin filas en este periodo" when N = 0 |
| Sheet step 2 | title the file name, subtitle the period; rows "Guardar en el teléfono" (download icon) and "Compartir" (share icon); picking one closes the sheet and runs the export |
| testIDs | `reports-summary`, `reports-top-volunteers`, `reports-attendance-split`, `reports-download` (card and button `-open`), sheet `reports-download-sheet`, rows `reports-download-volunteers`, `reports-download-activities`, `reports-download-save`, `reports-download-share`; `reports-volunteers-all` and `reports-activities-all` stay on the Ver detalle rows |

**API surface** (two changes):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/activities` | GET | `when`: adds `pending` to `upcoming \| past \| cancelled \| all`; `q`, `page` unchanged | same page of activities | `activities.read` (unchanged) | 400 invalid `when` |
| `/api/reports/summary` | GET | `from`, `to` unchanged | adds `presentCount`, `lateCount`, `absentCount` (integers) to today's fields | `reports.view` (unchanged) | unchanged (400 bad range) |

The summary change is additive, so an older app build ignores the new fields.

Used unchanged: `PUT /api/activities/:id/attendance/:assignmentId` with `{ status }` only (one tap), `POST …/mark-all-present`, `POST …/finalize`, `POST …/:assignmentId/correct`, `PATCH` status, assignment cancel, `GET /api/reports/volunteer-hours` (`limit=5`), and the two CSV export endpoints from spec 0006 (same audit entry and rate limit).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Progress strip, next step card | display step, card text, button | `activityStep`/`nextStep` in `src/utils/activity-flow.ts` from `activity.status`, `startsAt`, `attendanceFinalizedAt`, `assignedCount`, `capacity`, `participants[].attendance`, `user.role`, `user.id`, `supervisorId`, device clock |
| Finalizada card | hours counted | sum of `participants[].attendance.hours` for assigned people (already in `GET /api/activities/:id`) |
| Default tab | tab | `tab` route param, else `defaultTab` from the display step |
| One tap Presente / Falta | hours saved | API default in `server/src/attendance.ts` (activity length for present, 0 for absent); app sends `{ status }` only |
| Row after save | badge, hours | `attendance` in the PUT response |
| Finalize bar | enabled, "faltan N" | `n − r` from `participants` |
| List hint | hint text and tone | `listHint` from `ActivitySummary` fields and device clock |
| Por finalizar list | rows, order | `GET /api/activities?when=pending`, filter and sort per *Decision* |
| Más horas chart | names, hours, bar widths | `listVolunteerHours(period, 0, 5).rows` filtered to `hours > 0`; widths from the largest `hours` among them |
| Asistencia chart | three counts, percents | `presentCount`, `lateCount`, `absentCount` from `getSummary(period)` (server: `countedRecords` aggregate, finalized records of finalized activities in range) |
| Ver detalle notes, sheet row counts | N per file | volunteers: `total` of the `listVolunteerHours` call above; activities: `summary.activitiesHeld` (same `finalizedInRange` filter as the activity list and CSV), so the `listActivityAttendance` preview call is dropped |
| Download card and sheet | period, file kind, save or share | `range` state on the Reportes screen; kind and action from the sheet `step` state; result sentence from `useReportExport` |
| Offline fix | keep user on network failure | `user` already set in `AuthProvider` before the failed `currentStaff` call |

The device clock decides display steps only; the server still decides what is allowed (a wrong phone clock can show a button the API then refuses with its plain message).

**Key invariants**:
- No business rule moves to the app. Every action still goes through the existing endpoint and its checks; the UI only hides or shows.
- `activity-flow.ts` is the single source of the step, next step, default tab and list hint (also for spec 0008).
- A row never shows a status the server did not confirm.
- Every attendance write is still audited by the existing service functions (nothing new to audit; the list filter and the summary are reads).
- The charts and the CSVs count with the same `countedRecords` rule, so a chart never disagrees with the file for the same period. Exports still go only through the two CSV endpoints, so each one is still audited once.
- The summary shows names and hours only, the same fields the CSV already carries; no contact data.

**Security model**: unchanged. Visibility mirrors `src/constants/roles.ts`, which mirrors `server/src/permissions.ts`; the API enforces. The new `when=pending` value goes through the same zod schema and `activities.read` capability. No personal data is logged; the offline fix logs nothing.

**Critical test scenarios**:
- Happy path: coordinator opens a draft (Detalles tab, Publicar card), publishes, assigns from the card, and after the start time opens on Asistencia, taps Presente for two people and Falta for one, Tarde opens the form, then finalizes from the bar; card shows hours counted. Verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-8**.
- Failure case: turn off the network and tap Presente; the row keeps "Sin registrar" and shows the message. In Reportes offline, open the download sheet, pick a file and "Guardar en el teléfono"; the message shows on the card and the screen stays. Verifies **AC-5**, **AC-11b**, **AC-12**.
- Reportes: for the showcase period (September 2026, "Clasificación de alimentos · asistencia" finalized with present, late and absent rows), Más horas lists only people with hours, longest bar first, and tapping one opens the volunteer; the Asistencia bar's counts equal the sum of Presentes, Retardos and Faltas in the "Asistencia por actividad" CSV for the same period. Pick each file in the sheet and both Guardar and Compartir work; one audit `export` entry per file. A period with nothing finalized shows the empty state and the download card with "Asistencia por actividad" disabled. Verifies **AC-11**, **AC-11b**.
- Auth/permission: supervisor on another's activity sees no roll call buttons, no bar, no "⋯", no cancel; on their own activity sees the roll call. A coordinator on a finalized activity cannot tap rows; an admin can and gets the correction form. Verifies **AC-9**.
- List: an activity that ended yesterday without finalizing appears under Por finalizar with "Asistencia por finalizar"; after finalizing it leaves that list. Verifies **AC-10**.

## Build plan

Build approach: thin working slice first, then thicken (root `AGENTS.md`, `scope.md`). Each slice is usable on the emulator before the next.

1. Pure module `src/utils/activity-flow.ts` (`activityStep`, `nextStep`, `defaultTab`, `listHint`) and shared components `SegmentedTabs`, `ActionSheet`, `IconButton`, plus the `footer` prop on `Screen`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-8**, **AC-13**
2. Activity detail restructure: progress strip, next step card, header "⋯" with `ActionSheet` (Cerrar relabeled), tabs with default and `tab` param; Detalles tab from today's Detalles section, satisfies **AC-1**, **AC-2**, **AC-3**
3. Participantes tab: stat, Asignar button, rows with phone `IconButton` and "⋯" cancel sheet, Cancelados section, satisfies **AC-4**, **AC-9**
4. Asistencia tab roll call: per row Presente/Tarde/Falta with per row busy and error, Tarde and name tap to the form, progress line, Todos/Sin registrar filter, Marcar todos presentes, footer finalize bar, finalized read only view with admin correction tap, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
5. API `when=pending` in `listSchema` and `listQuery` (`server/src/activities.ts`); app list gets the hint line and the "Por finalizar" chip with its empty state, satisfies **AC-10**
6. Reportes, replacing the per report download cards built earlier:
   1. API: add `presentCount`, `lateCount`, `absentCount` to the `summary` aggregate in `server/src/reports.ts` and to `ReportSummary` in `src/services/reports.ts`, satisfies **AC-11**
   2. `src/components/bar-chart.tsx` with `HorizontalBars` and `StackedBar`; Resumen section and Ver detalle rows on the Reportes screen; remove the two previews and the `listActivityAttendance` preview call, satisfies **AC-11**
   3. `useReportExport(range)` hook taken out of `ExportActions` (which keeps its look and uses the hook); `detail` and `disabled` on `SheetAction`; the download card with the two step sheet; remove `DownloadSection`, satisfies **AC-11b**
7. `AuthProvider.refresh`: when a user is already signed in and the error is not a 401, keep `user` and `status = 'ready'`, satisfies **AC-12**
8. Verify: typecheck; API check for `when=pending` (and a bad `when` → 400) and for the new summary counts against the CSV; walk the critical scenarios on the Android emulator as coordinator, supervisor and admin, satisfies **AC-1** to **AC-13**

## Consequences

**Positive**:
- The next action is always on screen, so new staff can run an activity without training.
- Roll call drops from one form per person to one tap per person for the common case.
- The two common report questions (who gave the most hours, how attendance went) are answered on screen without a file, and the full file is one card away.
- `activity-flow.ts` gives the dashboard (spec 0008) the same rules for free.

**Negative / tradeoffs**:
- The detail screen is rewritten, so the Maestro flows and testIDs from features 3 and 4 that touch it need updating (keep existing testIDs where the element survives).
- Hidden actions: Editar and Cancelar move one tap deeper into "⋯".
- Two new shared components (`ActionSheet`, `SegmentedTabs`) to maintain instead of the native Compose ones.
- One tap saves mean a mis-tap writes a record (fixed by tapping the right status, which is audited as an update).
- The display step uses the phone clock; a badly set phone can show a step a few minutes early or late.
- Downloading takes two taps more than the per report cards (open the sheet, pick the file, pick how), and the per report cards already built get replaced. The 5 row activity preview goes away, so recent activities are one tap deeper (Ver detalle).
- Hand drawn bars have no axis or gridlines; fine for five rows and one split, not a base for richer charts later.

**Neutral**:
- No schema or migration. `AGENTS.md` → Design should list the new shared components (for `/sync`).
- Assignment cancellation once attendance exists stays blocked by the API, as in spec 0005.

## Follow-up

- [ ] Spec 0008 (Dashboard) reuses `activity-flow.ts` and `when=pending` for "Por finalizar".
- [ ] Open decision from feature 4 still stands: refuse schedule edits once attendance exists. Not in this spec.
- [ ] `/sync` after build: add `SegmentedTabs`, `ActionSheet` (with `detail`/`disabled`), `IconButton`, `BarChart`, `Screen footer` and `useReportExport` to `AGENTS.md` → Design, and the `tab` param to the activities line.
- [ ] The preview testIDs (`reports-volunteer-<id>`, `reports-activity-<id>`) and the per card download testIDs go away; no Maestro flow uses them today, so new report flows use the testIDs in *Reportes summary*.
