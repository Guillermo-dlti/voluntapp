# Scope: Volunt-App

A mobile app for BAMX volunteers to register, browse and sign up for shifts,
check in to activities, and track their hours — with a parallel admin side
for BAMX staff to manage activities, registrations, attendance, and hours.

Build it in a thin, working slice first — one volunteer registering, logging
in, and seeing the home screen — before making any single part fuller. Then
thicken it piece by piece.

## Stack

Expo SDK 57, Expo Router (file-based, `src/app` as root), TypeScript (strict),
React Native 0.86, React 19.2, `NativeTabs` for the bottom tab bar.

**Not yet decided** (real open questions carried over from Stage 1):
- Backend / database (Supabase, Firebase, custom API?)
- Auth method
- Notification/reminder system
- Whether volunteers self-enter hours or only BAMX validates them

## Roles

| Role | Can do |
|---|---|
| Volunteer | Register, view shifts, sign up, check in, view own hours/history, edit own profile |
| BAMX Administrator | Create/edit activities, review registrations, validate attendance and hours |
| Technical Administrator | Environment config, database, permissions, backups |

## Data model

| Entity | Key fields | Relationship |
|---|---|---|
| Volunteer | id, name, email, phone, status | has many Registrations, Attendance, Hours |
| Activity/Shift | id, name, description, date, time, location, capacity, status | has many Registrations |
| Registration | id, volunteer, activity, date, status | links Volunteer ↔ Activity |
| Attendance | id, registration, status, check-in time | belongs to a Registration |
| Hours | id, volunteer, activity, amount, validation status | generated from validated Attendance |

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Navigation & app shell | Foundation | in progress |
| 2 | Coding standards & tooling | Foundation | not started |
| 3 | Backend & data model | Foundation | not started |
| 4 | Design & look | Foundation | not started |
| 5 | Onboarding: Welcome, Login, Sign Up | Slice 1 | not started |
| 6 | Home Hub | Slice 1 | not started |
| 7 | Oportunidades: list, details, register, confirmation | Slice 1 | not started |
| 8 | Mis Actividades: upcoming/past, cancellation | Slice 2 | not started |
| 9 | Attendance / Check-In | Slice 2 | not started |
| 10 | Mi Impacto (hours, services, kg) | Slice 2 | not started |
| 11 | Perfil: view/edit, logout | Slice 2 | not started |
| 12 | Admin module | Slice 3 | not started |

## Foundation

### 1. Navigation & app shell

`src/app` already exists with Expo Router picking it up correctly (confirmed:
"Using src/app as the root directory for Expo Router"). Still the default
template — `index.tsx`/`explore.tsx` and a 2-tab bar need replacing with the
real 5-tab structure (Inicio, Ofertas, Mis Act., Impacto, Perfil) matching the
Figma prototype, plus an auth stack (Welcome → Login/Sign Up) in front of it.

- [x] Confirm Expo Router picks up `src/app`
- [ ] Decide route-group structure (auth stack vs. tabs)
- [ ] Build the tab bar with real 5 tabs
- [ ] Build the auth stack shell (empty screens OK for now)

### 2. Coding standards & tooling

- [ ] Decide on Prettier + ESLint config
- [ ] Add `typecheck`/`format` scripts to `package.json`
- [ ] Decide whether to add a pre-commit hook (Husky + lint-staged) given 4 people committing to one repo

### 3. Backend & data model

- [ ] Decide the backend (Supabase / Firebase / custom API)
- [ ] Decide the auth method
- [ ] Implement the Volunteer/Activity/Registration/Attendance/Hours schema
- [ ] Decide whether volunteers self-report hours or only admins validate

### 4. Design & look

Figma prototype exists (green BAMX branding, per the mockups). Not yet
translated into actual design tokens/theme constants.

- [ ] Pull colors/spacing from Figma into `src/constants/theme.ts`
- [ ] Confirm accessibility baseline (contrast, focus states) per team's own Stage 1 objectives

## Slice 1: Onboarding + core browse/register loop

### 5. Onboarding: Welcome, Login, Sign Up

Per the user manual: Welcome screen → Sign Up (name, email, password) or
Login (email, password) → Home Hub on success.

- [ ] Decide the approach
- [ ] Build it

### 6. Home Hub

Summary of next registered activity, featured/available opportunities, nav to
Opportunities/My Activities/Impact/Profile.

- [ ] Decide the approach
- [ ] Build it

### 7. Oportunidades: list, details, register, confirmation

List of available shifts → tap for full details (name, description, date,
time, location, requirements, spots) → Register → confirmation screen. On
success, activity appears in Mis Actividades.

- [ ] Decide the approach
- [ ] Build it

## Slice 2: Ongoing participation

### 8. Mis Actividades

Upcoming/Pasadas tabs, tap to review details again, cancellation if BAMX
policy allows (before a deadline).

- [ ] Decide the approach
- [ ] Build it

### 9. Attendance / Check-In

Per the mockup, this is QR-code based: volunteer opens Check-In on a
registered activity, the app shows a QR code volunteer presents on arrival to
have it scanned. Confirming attendance is what eventually generates hours.

- [ ] Decide how the QR is generated/validated (needs a backend decision first)
- [ ] Build it

### 10. Mi Impacto

Total accumulated hours, number of completed activities/services, kg
distributed, contribution history.

- [ ] Decide the approach
- [ ] Build it

### 11. Perfil

View/edit permitted personal info, log out.

- [ ] Decide the approach
- [ ] Build it

## Slice 3: Admin side

### 12. Admin module

Per the Technical/Admin Manual: create/edit/publish activities without
deleting history on cancellation; view registrations and process
cancellations without exceeding capacity; confirm attendance and
validate/record hours; view (not download/share) volunteer info.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

- Final installation/setup commands (documented once the stack is picked)
- Push notifications / reminders (open question, not committed to for MVP)
- Admin backups/maintenance tooling beyond what the chosen backend provides out of the box