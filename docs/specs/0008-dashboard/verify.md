# Verify: Dashboard · spec 0008 · updated 2026-10-14
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Before the emulator steps, restart Metro (`npx expo start --dev-client --clear`) so it picks up the new files.

## UI / manual (Android emulator)
- [ ] Sign in as coordinator, open Inicio → date eyebrow, greeting and role chip stay; "Horas este mes" full width (bare number, caption "horas finalizadas"), "Voluntarios activos" and "Actividades este mes" side by side → AC-1
- [ ] Compare "Horas este mes" with Reportes on "Este mes" → same number → AC-2
- [ ] Tap "Horas este mes" after picking "Mes pasado" in Reportes → Reportes opens on "Este mes"; tap it again from Inicio → still "Este mes" → AC-3
- [ ] Tap "Voluntarios activos" after choosing "Inactivos" in Voluntarios → list shows "Activos" → AC-3
- [ ] Open a volunteer detail in Voluntarios, go to Inicio, tap "Voluntarios activos" → lands on the root list, not the detail → AC-3
- [ ] Tap "Actividades este mes" after choosing "Pasadas" → Actividades shows "Próximas" → AC-3
- [ ] "Próximas actividades" shows at most 5 rows, same order and hints as the first rows of Actividades "Próximas"; tapping a row opens its detail; "Ver todas" opens Actividades on "Próximas" → AC-4
- [ ] "Por finalizar" shows at most 5 rows (oldest first) matching Actividades "Por finalizar"; a row opens on the Asistencia tab; "Ver todas" opens Actividades on "Por finalizar" → AC-5
- [ ] With nothing pending, the section shows "Nada pendiente" and the footer about finalized hours → AC-5
- [ ] Sign in as supervisor → no KPIs; "Hoy" (not pressable) and "Por finalizar" cards; lists only their own non draft activities; Reportes tab absent → AC-6
- [ ] Supervisor taps "Por finalizar" card → Actividades on "Por finalizar" with "Solo mis actividades" on, same set as Inicio → AC-6, AC-8
- [ ] Supervisor in Actividades: chip `activities-mine` sits on its own row under the `when` chips, on by default; turning it off shows every activity; empty states add "Solo ves las actividades que supervisas. Quita el filtro para ver todas." while on → AC-8
- [ ] Sign in as admin → same layout as coordinator; Actividades has no "Solo mis actividades" chip → AC-1, AC-8
- [ ] Finalize attendance in another tab, come back to Inicio → numbers update without a loading card; pull to refresh works → AC-9
- [ ] Load Inicio, stop the API, pull to refresh → last data stays with "No se pudo actualizar. Desliza hacia abajo para intentarlo de nuevo." → AC-10
- [ ] Cold start with the API stopped → EmptyState with a plain sentence and "Reintentar"; start the API and tap it → dashboard loads → AC-10
- [ ] Back from an activity opened on Inicio → returns to the Actividades list (accepted in the spec) → AC-4

## Commands (API against Atlas)
- [ ] `GET /api/dashboard` with no token → 401 → AC-7
- [ ] `GET /api/dashboard?scope=all` as coordinator → 400 "La consulta del inicio no es válida. Vuelve a cargar la pantalla." → AC-11
- [ ] Coordinator and admin → `scope: 'all'`, `own: null`, `kpis` with three numbers → AC-7
- [ ] `kpis.hoursThisMonth` equals `totalHours` and `kpis.activitiesThisMonth` equals `activitiesScheduled` of `GET /api/reports/summary?from=<1st>&to=<last day>` for the current Guadalajara month → AC-2
- [ ] `kpis.activeVolunteers` equals the count of `volunteers` with `status: 'active'` in Atlas → AC-2
- [ ] Supervisor → `scope: 'own'`, `kpis: null`, every returned activity has their `supervisorId` and no draft, even with other supervisors' and unsupervised activities in the database → AC-6, AC-7
- [ ] Supervisor `own.pending` equals the length of `GET /api/activities?when=pending&mine=true` (when under 20) → AC-6
- [ ] Supervisor `own.today`: create (or move) one of their open activities to start today in Guadalajara → count goes up by 1; a draft starting today doesn't count → AC-6
- [ ] `upcoming` and `pending` equal the first 3 and the first 5 of `GET /api/activities?when=upcoming|pending` (plus `mine=true` for a supervisor) → AC-4, AC-5
- [ ] `GET /api/activities?mine=false` → 400; `mine=true` with `when=all` returns only the caller's non draft activities → AC-8
- [ ] Month edge: a finalized activity starting on the 1st at 00:30 Guadalajara counts this month; one on the last day of the previous month at 23:30 doesn't → AC-2
- [ ] After several dashboard loads, `audit_log` has no new entries and the server log lines carry no names or emails → AC-11

## Acceptance-criteria coverage
- AC-1 UI 1, 13 · AC-2 UI 2, commands 4, 5, 11 · AC-3 UI 3 to 6 · AC-4 UI 7, 17, commands 9 · AC-5 UI 8, 9, commands 9 · AC-6 UI 10, 11, commands 6 to 8 · AC-7 commands 1, 3, 6 · AC-8 UI 11 to 13, commands 10 · AC-9 UI 14 · AC-10 UI 15, 16 · AC-11 commands 2, 12
