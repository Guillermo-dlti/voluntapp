# 0007. Guided activity flow, roll call attendance, and findable report exports

**Date**: 2026-10-13
**Status**: Proposed

## Summary

Staff find the activity screens hard to use: the detail screen is one long scroll that never says what to do next, attendance takes one form per person, and report downloads hide inside the "Ver todos" lists. This spec reorganizes those screens without changing any business rule. An activity now shows where it is in its life (borrador, publicada, asistencia, finalizada) and one button for the next step. Attendance becomes a roll call with one tap per person. Each report gets its own download card on the main Reportes screen. The only API change is a new "Por finalizar" filter on the activities list.

## Requirements

**User stories**:
- As a coordinator, I want each activity to tell me its next step so that I don't have to remember the order (publish, assign, take attendance, finalize).
- As a coordinator or supervisor, I want to mark attendance with one tap per person so that a roll call of 15 people takes a minute, not 15 trips to a form.
- As a coordinator, I want to see which activities still need attendance finalized so that hours don't go uncounted.
- As an admin or coordinator, I want the report downloads on the main Reportes screen so that I can find them without opening a list.

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
- **AC-11**: The main Reportes screen has a "Descargar reportes" section, right after the stat cards, with one card per report ("Horas por voluntario", "Asistencia por actividad"). Each card says in one line what the file contains, shows the selected period, and holds Descargar and Compartir (the existing `ExportActions`) for that period. Buttons are disabled with the existing hint when the report has no rows. The previews and "Ver todos" lists stay below; the sub screens keep their export buttons too.
- **AC-12**: When a signed in user's background session check fails for a reason other than 401 (no connection, timeout), the app keeps the current screen and user instead of replacing it with the full screen error. So tapping Descargar offline shows "No hay conexión…" under the button. A 401 still signs out, and a failed check at app launch (no user yet) still shows the full screen error.
- **AC-13**: All new copy is Spanish, plain, and follows `AGENTS.md` → Design. Icon only buttons (phone, ⋯) have Spanish accessibility labels ("Llamar a <nombre>", "Más acciones") and touch targets of at least 48 dp. No raw error text reaches the screen.

## Decision

**Chosen option**: Option 2: Guided restructure of the existing screens, app side, with one small API filter.

Rebuild the activity detail around a computed "next step", turn attendance into an inline roll call that reuses the existing attendance endpoints, add a `when=pending` list filter, move report exports onto the main Reportes screen, and fix the offline session check. No schema change, no new business rule.

Small calls made here (pick, why, runner up):
- **Tabs** are a new shared `SegmentedTabs` in `src/components`, built in React Native like `FilterChips` (flat, 1px border, selected fill `primary`). Why: reliable layout inside the `Screen` scroll view; the Compose pickers already caused layout jumps there. Runner up: `@expo/ui` `SingleChoiceSegmentedButtonRow`.
- **Menus** (header "⋯" and the participant "⋯") are a new shared `ActionSheet` in `src/components`: a React Native `Modal` sliding from the bottom with a title, action rows (critical ones in `danger` color) and "Volver". Why: Android `Alert` shows at most three buttons and the header menu can need four plus Volver; same Compose layout risk as above. Runner up: `@expo/ui` `DropdownMenu`.
- **Fixed bottom bar**: `Screen` gets an optional `footer` prop rendered under the sheet, above the safe area, and the scroll content gets bottom padding for it. Why: one place for every future sticky action. Runner up: a one off absolute view in the detail screen.
- **Icon buttons**: a small shared `IconButton` (48 dp target, flat, 1px border) for phone and "⋯". Why: used in at least three places.
- **The flow logic** lives in one pure module `src/utils/activity-flow.ts` (`activityStep`, `nextStep`, `defaultTab`, `listHint`), so the detail screen, the list, and the dashboard (spec 0008) agree. Runner up: computing it inside each screen.
- **Roll call saves** are not optimistic: the row waits for the API answer and then shows it. Why: attendance becomes official hours; a row should never show a status the server refused. Runner up: optimistic update with rollback.
- **Pending definition** (`when=pending`): `status ∈ {open, closed}`, `startsAt ≤ now`, no `attendanceFinalizedAt`, sorted by `startsAt` ascending. Why: it is exactly the set the finalize endpoint accepts and what Reportes counts as pending, so the three never disagree.

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

**API surface** (one change):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/activities` | GET | `when`: adds `pending` to `upcoming \| past \| cancelled \| all`; `q`, `page` unchanged | same page of activities | `activities.read` (unchanged) | 400 invalid `when` |

Used unchanged: `PUT /api/activities/:id/attendance/:assignmentId` with `{ status }` only (one tap), `POST …/mark-all-present`, `POST …/finalize`, `POST …/:assignmentId/correct`, `PATCH` status, assignment cancel, and the reports export endpoints from spec 0006.

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
| Report card | period, rows to export | `range` state on the Reportes screen; `total` from the preview pages already loaded (`volunteers.total`, `activities.total`) |
| Offline fix | keep user on network failure | `user` already set in `AuthProvider` before the failed `currentStaff` call |

The device clock decides display steps only; the server still decides what is allowed (a wrong phone clock can show a button the API then refuses with its plain message).

**Key invariants**:
- No business rule moves to the app. Every action still goes through the existing endpoint and its checks; the UI only hides or shows.
- `activity-flow.ts` is the single source of the step, next step, default tab and list hint (also for spec 0008).
- A row never shows a status the server did not confirm.
- Every attendance write is still audited by the existing service functions (nothing new to audit; the list filter is a read).

**Security model**: unchanged. Visibility mirrors `src/constants/roles.ts`, which mirrors `server/src/permissions.ts`; the API enforces. The new `when=pending` value goes through the same zod schema and `activities.read` capability. No personal data is logged; the offline fix logs nothing.

**Critical test scenarios**:
- Happy path: coordinator opens a draft (Detalles tab, Publicar card), publishes, assigns from the card, and after the start time opens on Asistencia, taps Presente for two people and Falta for one, Tarde opens the form, then finalizes from the bar; card shows hours counted. Verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-8**.
- Failure case: turn off the network and tap Presente; the row keeps "Sin registrar" and shows the message. Tap Descargar in Reportes offline; the message shows under the button and the screen stays. Verifies **AC-5**, **AC-12**.
- Auth/permission: supervisor on another's activity sees no roll call buttons, no bar, no "⋯", no cancel; on their own activity sees the roll call. A coordinator on a finalized activity cannot tap rows; an admin can and gets the correction form. Verifies **AC-9**.
- List: an activity that ended yesterday without finalizing appears under Por finalizar with "Asistencia por finalizar"; after finalizing it leaves that list. Verifies **AC-10**.

## Build plan

Build approach: thin working slice first, then thicken (root `AGENTS.md`, `scope.md`). Each slice is usable on the emulator before the next.

1. Pure module `src/utils/activity-flow.ts` (`activityStep`, `nextStep`, `defaultTab`, `listHint`) and shared components `SegmentedTabs`, `ActionSheet`, `IconButton`, plus the `footer` prop on `Screen`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-8**, **AC-13**
2. Activity detail restructure: progress strip, next step card, header "⋯" with `ActionSheet` (Cerrar relabeled), tabs with default and `tab` param; Detalles tab from today's Detalles section, satisfies **AC-1**, **AC-2**, **AC-3**
3. Participantes tab: stat, Asignar button, rows with phone `IconButton` and "⋯" cancel sheet, Cancelados section, satisfies **AC-4**, **AC-9**
4. Asistencia tab roll call: per row Presente/Tarde/Falta with per row busy and error, Tarde and name tap to the form, progress line, Todos/Sin registrar filter, Marcar todos presentes, footer finalize bar, finalized read only view with admin correction tap, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
5. API `when=pending` in `listSchema` and `listQuery` (`server/src/activities.ts`); app list gets the hint line and the "Por finalizar" chip with its empty state, satisfies **AC-10**
6. Reportes: "Descargar reportes" section with one card per report using `ExportActions`, satisfies **AC-11**
7. `AuthProvider.refresh`: when a user is already signed in and the error is not a 401, keep `user` and `status = 'ready'`, satisfies **AC-12**
8. Verify: typecheck; API check for `when=pending` (and a bad `when` → 400); walk the critical scenarios on the Android emulator as coordinator, supervisor and admin, satisfies **AC-1** to **AC-13**

## Consequences

**Positive**:
- The next action is always on screen, so new staff can run an activity without training.
- Roll call drops from one form per person to one tap per person for the common case.
- Report downloads are visible where staff look first.
- `activity-flow.ts` gives the dashboard (spec 0008) the same rules for free.

**Negative / tradeoffs**:
- The detail screen is rewritten, so the Maestro flows and testIDs from features 3 and 4 that touch it need updating (keep existing testIDs where the element survives).
- Hidden actions: Editar and Cancelar move one tap deeper into "⋯".
- Two new shared components (`ActionSheet`, `SegmentedTabs`) to maintain instead of the native Compose ones.
- One tap saves mean a mis-tap writes a record (fixed by tapping the right status, which is audited as an update).
- The display step uses the phone clock; a badly set phone can show a step a few minutes early or late.

**Neutral**:
- No schema or migration. `AGENTS.md` → Design should list the new shared components (for `/sync`).
- Assignment cancellation once attendance exists stays blocked by the API, as in spec 0005.

## Follow-up

- [ ] Spec 0008 (Dashboard) reuses `activity-flow.ts` and `when=pending` for "Por finalizar".
- [ ] Open decision from feature 4 still stands: refuse schedule edits once attendance exists. Not in this spec.
- [ ] `/sync` after build: add `SegmentedTabs`, `ActionSheet`, `IconButton`, `Screen footer` to `AGENTS.md` → Design, and the `tab` param to the activities line.
