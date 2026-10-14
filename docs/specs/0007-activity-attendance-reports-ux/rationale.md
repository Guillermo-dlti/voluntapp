# 0007. Rationale: guided activity flow, roll call attendance, and findable report exports

## Context

Features 3, 4 and 6 delivered every rule BAMX needs (capacity, overlap, attendance, finalizing, reports), and the API checks pass. But when staff tried the app, they said running an activity is hard to follow and the reports are hard to download. The problem is how the screens are organized, not what they can do.

The activity detail screen (`src/app/(tabs)/actividades/[id]/index.tsx`) stacks everything in one scroll. Details come first, then up to five full width buttons (Publicar, Cerrar actividad, Volver a borrador, Editar datos, Cancelar actividad) that look equally important. Then a capacity stat, the Participantes list, an Asignar button, the Cancelados list, and finally the Asistencia list. Asistencia shows the same people as Participantes a second time. The activity moves through a lifecycle (draft, open, attendance, finalized), but the screen never says where it is or what comes next. "Cerrar actividad" and "Finalizar asistencia" both end in the `closed` status, and nothing says which one to use. In fact the API still accepts attendance and finalizing on a closed activity, so "Cerrar" only stops edits and new assignments. Calling or cancelling a person sits behind an Alert that opens when you tap their name.

Recording attendance opens a full form screen per person (`asistencia/[assignmentId].tsx`), even though the common case (present for the whole activity) needs no input: the API already fills in the hours from the activity length when only a status is sent.

On Reportes (`src/app/(tabs)/reportes/index.tsx`), Descargar and Compartir exist only inside the two "Ver todos" sub screens. The main screen shows numbers and previews but no way to download, so staff don't find exports. A known feature 6 bug makes it worse: tapping Descargar offline replaces the whole screen with "No hay conexión", because returning from the Android folder picker triggers a session check that treats any network failure as fatal.

Constraints: no business rule may move or change (they are graded and verified in the API); reuse the shared components and Design rules in `AGENTS.md`; Android only; Spanish UI; the dashboard (spec 0008) is designed right after this and needs the same notion of "what's pending".

## Options considered

### Option 1: Polish in place

Keep the one scroll layout. Reorder sections so Asistencia comes first when relevant, shrink the action buttons to secondary style, add a short help line, and add export buttons to the Reportes main screen.

**Pros**:
- Smallest change, low risk to testIDs and flows.
- No new shared components.

**Cons**:
- Still no clear next step; staff still have to know the lifecycle.
- Attendance still needs a form per person.
- The duplicated people lists and the long scroll stay.

### Option 2: Guided restructure of the existing screens (chosen)

Compute the activity's step and next action in one pure module, show them as a progress strip and a next step card, move rare actions into a "⋯" sheet, split the screen into three tabs, make attendance a one tap roll call on the existing endpoints, add a "Por finalizar" list filter, and put a download card per report on the Reportes main screen.

**Pros**:
- Answers "what do I do now" on every activity, for every role.
- Roll call matches how attendance is actually taken on site.
- No business rule or schema change; the existing API checks still cover everything.
- The flow module is reusable by the dashboard.

**Cons**:
- Rewrites the detail screen; testIDs and walk steps from features 3 and 4 need updating.
- Two new shared components to maintain.
- One more tap for Editar and Cancelar.

### Option 3: Task based navigation

Replace the activity detail with separate full screens per task (a wizard: publish, assign, take attendance, finalize) launched from the dashboard and the list.

**Pros**:
- Each screen does exactly one thing.
- Very clear for first time users.

**Cons**:
- Many more routes and back stack states to get right.
- Hard to see an activity as a whole (details, people, attendance) in one place, which `AGENTS.md` asks for ("Detalles, Participantes, Asistencia").
- Much more build and verification time for a graded semester project.

## Rationale

Option 2 fixes the root cause: the screens don't express the lifecycle. A single computed "next step" turns the order of operations from something staff must remember into something the app shows, and the progress strip makes the state visible at a glance. Option 1 would leave that root cause in place, and Option 3 would solve it at a cost (many routes, a split view of the activity) that doesn't fit the team's time or the three section layout `AGENTS.md` already promises.

The roll call follows how attendance happens on site: one person with a phone, a list of names, most people present. Sending only the status reuses the API's own hour defaults, so the rules from spec 0005 (hours within the activity length, finalized records locked) are untouched and still verified on the server. Tarde opens the form because a late arrival usually changes the hours, which the engineer confirmed. Saves are not optimistic because attendance becomes official hours, and a row must never show something the server refused.

The "Por finalizar" filter uses exactly the conditions the finalize endpoint accepts and Reportes already counts as pending, so the list, the report banner and the dashboard can't disagree. Relabeling "Cerrar actividad" to "Cerrar inscripciones" and moving it into "⋯" removes the confusion with finalizing without taking away the rare case where coordinators want to stop assignments early. The engineer chose: Tarde opens the form, Cerrar moves to "⋯", tabs over one scroll, a card per report, the next step hint plus the Por finalizar chip in the list, a visible phone icon plus "⋯" per person, the current UI and `AGENTS.md` as the design source, and fixing the offline bug here.
