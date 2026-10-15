# Verify: QR check in · spec 0009 · updated 2026-10-15
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Already checked during the build (2026-10-15), against a throwaway local replica set, not Atlas: every API step below except the phone ones passed (36/37; the miss was the script counting a scan made earlier in the same minute, the 429 itself was right). The emulator showed the QR card, "Escanear", the "QR" note, the permission screen and the camera view. Still open: a real scan on a phone in Expo Go.

## UI / manual (phone in Expo Go, see server/README.md)
- [ ] `HOST=0.0.0.0`, `EXPO_PUBLIC_API_URL=http://<LAN IP>:3000`, `npm run server:seed:qr`, `npx expo start --go -c` → app loads on the phone and logs in → AC-15
- [ ] Check that the date and time fields (`@expo/ui`) open in Expo Go: Actividades → Nueva → Fecha → AC-15 (spec follow-up)
- [x] Coordinator: demo activity → Asistencia → "Escanear" → "Permitir cámara" → camera with torch and close → AC-13 _(emulator dev build, 2026-10-15)_
- [ ] Scan the 4 assigned cards in `server/demo-qr.html` → 4 green banners "Nombre · Presente", count reaches "4 de 4 registrados" → AC-5, AC-13
- [ ] Hold the same card for 10 s → one request, then after 3 s an amber "Ya registrado" → AC-6, AC-13
- [ ] Scan the "sin lugar" card → red "… no tiene lugar en esta actividad." → AC-7
- [ ] Scan the fake card → red "Código no válido"; scan any other QR (a URL) → same banner, no request in the server log → AC-9
- [ ] Turn off Wi‑Fi, scan → red "No hay conexión. Vuelve a escanear."; turn it on, scan the same card at once → it registers → AC-13
- [ ] Close → roll call reloads with the 4 records, each "3 h · QR" → AC-13, AC-14
- [ ] Deny the camera twice, reopen → "Abrir ajustes" opens the app's settings → AC-13
- [ ] Supervisor (`supervisor@bamx.test`) on the demo activity → "Escanear" shows and works; on an activity they don't supervise → no "Escanear" → AC-10, AC-13
- [x] Volunteer detail as coordinator → QR card and "Generar nuevo código" → confirm → toast; the old card now scans "Código no válido" → AC-2, AC-4 _(old code checked through the API, not the camera)_
- [x] Volunteer detail as supervisor → QR shows, no regenerate button → AC-2, AC-4
- [x] After `endsAt` (or on a finished activity) → no "Escanear" button → AC-13
- [ ] Delete `server/demo-qr.html` after the demo → AC-15

## Commands (API; run against a test database, never Atlas)
- [x] `POST /api/volunteers` → `volunteer.checkinToken` matches `^[A-Za-z0-9_-]{32}$`; `GET /api/volunteers` has no `checkinToken` → AC-1
- [x] `GET /api/volunteers/:id` as supervisor → token returned → AC-2
- [x] Check in with no session → 401 → AC-10
- [x] First scan before `startsAt` (attendance started) → 201 `checked_in`, `present`, `checkInAt` = `startsAt`, stored `method: 'qr'`, `hours` = activity span, one `insert` audit → AC-5 (value source: `max(now, startsAt)`)
- [x] Move `startsAt` 30 min into the past, scan a fresh assignee → `late`, `checkInAt` ≈ now, hours = `endsAt − now` → AC-5 (value source: `now > startsAt + 15 min`)
- [x] Response `counts` = recorded records of `assigned` assignments / `activity.assignedCount` → AC-5 (value sources: counts)
- [x] Same token again → 200 `already`, no audit entry; on a hand recorded Falta → message ends "Falta" → AC-6
- [x] Token of an active volunteer not on the activity → 409 `not_assigned` with the name → AC-7
- [x] Assigned volunteer set `inactive` → 409 `inactive`, nothing written → AC-8
- [x] Well formed unknown token and `"hola mundo"` → 404 `invalid`, "Código no válido" → AC-9
- [x] Draft, cancelled, finalized, not started → 409 with the roll call messages; ended → 409 "La actividad ya terminó…"; other supervisor's activity → 403; unknown id → 404 → AC-10
- [x] 61 scans in a minute by one staff member → the 61st is 429 with a Spanish message → AC-11
- [x] Three parallel scans of one token → one 201, two 200, exactly one attendance record → AC-12
- [x] `PUT` roll call record → `method: 'manual'`; activity detail returns `attendance.method` → AC-14
- [x] `POST /api/volunteers/:id/checkin-token` as supervisor → 403; as coordinator → new token, old one `invalid`, audit `before`/`after` differ in `checkinTokenIssuedAt` and hold no token → AC-4
- [x] `npm run server:backfill:checkin` with no actor / a coordinator → refused; with an admin → N issued, N admin `update` audits; second run → "No se cambió nada" → AC-3
- [x] `npm run server:seed:qr` twice → one demo activity, `assignedCount` 4, `demo-qr.html` with 6 QRs, file mode 600 → AC-15
- [x] `audit_log` has no `before.checkinToken`/`after.checkinToken`; server log holds no token or name → AC-1

## Acceptance-criteria coverage
- AC-1 list, create, audit and log checks · AC-2 detail read, QR card UI · AC-3 backfill command · AC-4 regenerate API and UI · AC-5 first scan, late scan, counts · AC-6 repeat and hand recorded scans · AC-7 outsider · AC-8 inactive · AC-9 invalid API and phone side · AC-10 gate refusals and roles · AC-11 rate limit · AC-12 parallel scans · AC-13 scanner UI steps · AC-14 manual method · AC-15 phone setup and demo seed
