# Verify: Reports and CSV export · spec 0006 · updated 2026-10-13
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Already checked during the build (2026-10-13, against Atlas and the emulator) are marked ✔ in the note; run them again anyway before merging.

## Commands (API, as `coordinador@bamx.test` unless noted)
- [x] `GET /api/reports/summary?from=2026-02-30&to=2026-03-01` → 400, `fields.from` set (✔ build) → AC-1
- [x] `from` after `to` → 400, `fields.to` "La fecha de fin no puede ser anterior a la de inicio." (✔ build) → AC-1
- [x] `from=2025-10-01&to=2026-10-31` (396 days) → 400; `from=2024-01-01&to=2024-12-31` (366 days, leap year) → 200 (✔ build) → AC-1
- [x] Unknown param (`&x=1`) or missing `to` → 400 plain message (✔ build) → AC-1
- [ ] Range edges: create and finalize an activity starting 23:30 Guadalajara on the last day of a month → it counts in that month; one starting 00:00 the next day → it doesn't → AC-1 (value source: Guadalajara midnight via Intl, not a fixed −6)
- [ ] Record attendance on an activity in range without finalizing → no number changes, `pendingActivities` goes up by 1 → AC-2, AC-3
- [x] Summary for October 2026 equals the sum of the activity list rows (`totalHours`), distinct present/late volunteers, finalized count (✔ build: 61.56 h, 3, 1, pending 2) → AC-3
- [ ] `volunteer-hours`: an active volunteer with no records shows 0; an inactive one with hours in range shows; an inactive one without doesn't → AC-4
- [x] Sort: hours desc, then last name with `es-MX` collation (accents don't scramble), then id; `offset=4&limit=2` continues the first page (✔ build) → AC-4
- [x] Consistency: with a range covering all their activities, a volunteer's `hours`/`completedActivities` equal `GET /api/volunteers/:id` totals (✔ build: 24.52 h, 2) → AC-4
- [x] `limit=51` → 400 (✔ build) → AC-4, AC-5
- [x] `activity-attendance` row counts (present/late/absent, recordCount, totalHours, attendanceFinalizedAt) match the activity's Asistencia section → AC-5
- [x] Both CSVs: BOM `EF BB BF`, CRLF, quoted text, `dd/mm/aaaa HH:mm` in Guadalajara time, dot decimals, `Content-Disposition` file name from `from`/`to`, `Cache-Control: no-store`; an empty range gives just the header (✔ build) → AC-6
- [x] Volunteer CSV has only ID, Nombre, Apellidos, Estado, Horas, Actividades completadas, Retardos, Faltas (no contact data) (✔ build) → AC-6
- [ ] Open both CSVs in es-MX Excel → columns split, accents correct → AC-6
- [ ] Rename an activity to `=HYPERLINK("http://x")`, export → cell is `'=HYPERLINK(...)` (✔ build, unit check of the writer) → AC-7
- [x] Each export adds exactly one `audit_log` entry: `action: export`, `collection: reports`, `after: { report, from, to, rowCount }`, no `recordId`, no names (✔ build) → AC-8
- [ ] Server log shows `report_exported` with staff id, report, row count only → AC-8
- [ ] 21st export in 15 minutes by the same staff member → 429 with "Hiciste demasiadas exportaciones seguidas…"; a 400 export doesn't count; another staff member is not blocked (note: writes 20 permanent audit entries) → AC-9
- [x] As `supervisor@bamx.test`: all five routes → 403; with no token → 401 (✔ build) → AC-10

## UI / manual (Android emulator)
- [x] Coordinator: Reportes tab opens on "Este mes" with three stat cards and the pending line when there is unfinalized work (✔ build) → AC-3, AC-11
- [x] "Mes pasado" and "Este año" change the subtitle and numbers; "Personalizado" shows Desde/Hasta with the current period, and an invalid pair shows the field message without calling the API → AC-1, AC-11
- [x] A period with no finalized activities shows the EmptyState "No hay actividades finalizadas en este periodo" → AC-11
- [ ] Previews show 5 rows each; "Ver todos" opens the full list; scrolling past 50 rows loads more → AC-11
- [x] Tapping a volunteer row opens the volunteer detail; tapping an activity row opens the activity detail → AC-11
- [x] "Compartir" shows "Preparando…", then the share sheet with `reporte-…csv` (✔ build) → AC-12
- [x] "Descargar" opens Android's folder picker in Download; Download itself can't be chosen, so create or pick a folder inside it ("Reportes BAMX") → file saved with BOM, the app says "Listo. Guardamos el archivo CSV en la carpeta que elegiste." (✔ build) → AC-12 (added after the spec)
- [x] Download the same report twice into the same folder → the first is kept, the second is saved as "… (1).csv" (✔ build) → AC-12
- [x] Open "Descargar" and close the picker without choosing → no message, and no new `export` entry in `audit_log` (✔ build for the message) → AC-8, AC-12
- [ ] Share to Drive and to Gmail with a signed in Google account → the file arrives intact (the app deletes its copy after `shareAsync` returns; on the build check it returned only when leaving Gmail) → AC-12
- [ ] Airplane mode → plain "No hay conexión…" sentence on both buttons; both buttons disabled when the list total is 0 → AC-12
- [ ] Sign the session out on the server, tap export → app signs out → AC-12
- [x] Supervisor: no Reportes tab → AC-10

## Acceptance-criteria coverage
- AC-1 range rules, edges, presets · AC-2 finalized only · AC-3 summary · AC-4 volunteer hours · AC-5 activity attendance · AC-6 CSV format · AC-7 injection · AC-8 audit · AC-9 rate limit · AC-10 roles · AC-11 screens · AC-12 export and share: each covered by the steps tagged above.
