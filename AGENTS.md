# Volunt-App

## What this is

An Android admin app for Banco de Alimentos de Guadalajara (BAMX). BAMX staff use it to manage volunteer records, activities and shifts, assignments, attendance, hours, participation history, and reports.

The users are BAMX staff, with three roles: **admin**, **coordinator**, **supervisor**. Volunteers are records that staff manage. **Volunteers do not log in.** Don't build volunteer-facing features unless explicitly asked.

This is v2. v1 was the same app aimed at volunteers (self sign-up, browsing shifts, QR check-in). Same stack, same repo; the admin screens replaced the volunteer screens in place. The full v1 app is preserved under the git tag `v1` (`git checkout v1`); see `scope.md` → "v1 code".

Built for TC2005B.502, Grupo 402. **Security is graded** in the team's Cybersecurity course ("Integración de seguridad informática en redes y sistemas de software"), so authorization, data protection, and auditability are requirements, not polish.

Read `scope.md` before building anything. It is the living plan, broken into features, tracking what's done versus what's still open. Keep it up to date as you go: that's how a fresh conversation, or a teammate, picks this up without anyone re-explaining the project.

## Stack

Decided in [`docs/specs/0001-v2-android-admin-stack.md`](docs/specs/0001-v2-android-admin-stack.md).

| Layer | Choice |
|---|---|
| App | Expo SDK 57, Expo Router (`src/app`), `NativeTabs`, TypeScript strict. Delivered on **Android** (`npm run android`, a dev build; not Expo Go). |
| API | Node.js + TypeScript + Express 5 in `server/`, with zod, helmet, express-rate-limit, argon2. |
| Database | **MongoDB Atlas**, Cluster0 in Guillermo's Atlas org, database `voluntapp`. Official `mongodb` driver (no Mongoose). |
| E2E | Maestro flows in `.maestro/` against the real app and API. |

Setup and local run: `server/README.md`.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code. This project is on Expo SDK 57 with the new `NativeTabs` API (`expo-router/unstable-native-tabs`), not the classic `Tabs`. General Expo knowledge may be stale for this version — check the version-specific docs rather than assuming.

## How to work

Before building anything, decide what you're doing and why, in a few plain sentences. Don't write code yet at that point. Report the decision, then stop and wait — don't move on to building until told to go ahead.

If something genuinely forks — where a reasonable person could go two different ways and it matters which — ask, one question at a time, with two or three concrete options. Most things don't need asking; decide those and say what you decided.

Then build it. If the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Break a build step into its own short checklist in `scope.md`, and check items off as they're finished. Work one feature at a time; at the end of each, stop, summarize, list anything that needs a decision, and wait.

## Rules

- Strict TypeScript, no `any`.
- File-based routing lives in `src/app` only — Expo Router convention. `@/*` resolves to `src/*` (see `tsconfig.json`).
- Shared UI belongs in `src/components`, not copy-pasted across screens.
- UI text in Spanish (es-MX). Code, comments, commits, and database names in English. Show dates in `es-MX`, timezone `America/Mexico_City`; store them as BSON dates (UTC).
- Validate all user input, in the app and again in the API. Share the rules: the API's zod schemas are the source of truth.
- Never show a raw exception or backend error to staff — a plain, human sentence, always.
- Comments only where they explain something non-obvious; when they do, say what and why.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). One feature per branch (`feature/<name>`, `fix/<name>`), never commit to `main`. Before merging, another team member reviews the PR and confirms the main flow still works.
- Verification is manual for now: run it on the Android emulator and walk the real flow. Feature 8 (Hardening) adds automated tests where each role tries forbidden actions, which reverses v1's "no test runner" choice; the tool gets picked there.
- See `coding-standards.md` for the long version.

## Security (required)

- **Staff auth is hand-implemented.** Passwords hashed with argon2id. Never store or log a plain password. Login is rate limited and answers the same message for an unknown email and a wrong password.
- **Sessions:** opaque random 256-bit tokens. The app keeps the raw token in Expo SecureStore (encrypted by the Android Keystore, private to the app; this is the native equivalent of an `httpOnly` cookie, since there is no browser). The server stores only its SHA-256 hash with an expiry. Never put a token in plain storage (AsyncStorage) or in logs.
- **Deactivated staff (`active = false`) are logged out:** every request checks `active`, and deactivating someone revokes their sessions.
- **Role checks on the server, on every endpoint.** Every route checks the session and the role before touching data, using one shared permission map (`server/src/permissions.ts`). The app hiding a button is never the protection.
- **Mongo validation:** every collection has a `$jsonSchema` validator plus the unique indexes in the data model, created by the server on startup.
- **The Mongo URI only ever lives on the server `.env`.** Never in the app, never behind `EXPO_PUBLIC_`. `EXPO_PUBLIC_` vars ship inside the APK; only the public API URL goes there.
- **Secrets in `.env` only** (gitignored). `.env.example` lists every variable name with no real values, and it is committed. (Right now it's deleted and gitignored on `main`; feature 0 restores it.)
- **No hard deletes.** Deactivate volunteers and staff, cancel activities and assignments. No endpoint removes a document.
- **Audit log:** every create, update, or state change on `staff_users`, `volunteers`, `activities`, `assignments`, and `attendance`, plus every CSV export, writes one entry to `audit_log`. It is insert only: no endpoint updates or deletes an entry.
- **No personal data in logs:** no names, emails, phones, birth dates, passwords, tokens, or request bodies in server logs or the app console. Log IDs and actions.
- **CSV exports** are generated by the API, only for roles allowed below, and guarded against formula injection.

## Roles and permissions

First draft; BAMX may still change it, so every check reads from the one permission map in `server/src/permissions.ts` (the app mirrors it only to hide what the user can't do).

| Capability | admin | coordinator | supervisor |
|---|---|---|---|
| Manage staff accounts and roles | ✅ | ❌ | ❌ |
| Create/edit/deactivate volunteers | ✅ | ✅ | ❌ (read only) |
| Create/edit/cancel activities | ✅ | ✅ | ❌ |
| Assign volunteers to activities | ✅ | ✅ | ❌ |
| Record attendance and hours | ✅ | ✅ | ✅ (only activities where they are `supervisorId`) |
| Finalize attendance | ✅ | ✅ | ✅ (own activities) |
| Correct **finalized** attendance | ✅ | ❌ | ❌ |
| View reports / export CSV | ✅ | ✅ | ❌ |
| View audit log | ✅ | ❌ | ❌ |

## Data model (MongoDB collections)

Every document has `_id` (ObjectId), `createdAt`, `updatedAt` (BSON dates). References are ObjectIds.

| Collection | Fields | Indexes / constraints |
|---|---|---|
| `staff_users` | `fullName`, `email`, `passwordHash`, `role` (`admin` \| `coordinator` \| `supervisor`), `active`, `sessions[]` (`tokenHash`, `createdAt`, `expiresAt`) | unique `email` (trimmed, lowercased); index on `sessions.tokenHash` |
| `volunteers` | `firstName`, `lastName`, `email` (optional), `phone`, `birthDate` (optional), `emergencyContactName`, `emergencyContactPhone`, `status` (`active` \| `inactive`), `notes`, `createdBy` | unique `email` when present (partial index) |
| `activities` | `name`, `description`, `location`, `startsAt`, `endsAt`, `capacity`, `requirements`, `status` (`draft` \| `open` \| `closed` \| `cancelled`), `supervisorId` (optional), `createdBy` | `endsAt > startsAt`, `capacity ≥ 1` |
| `assignments` | `volunteerId`, `activityId`, `assignedBy`, `status` (`assigned` \| `cancelled`), `cancelledReason` | unique (`volunteerId`, `activityId`) |
| `attendance` | `assignmentId`, `status` (`present` \| `absent` \| `late`), `checkInAt`, `checkOutAt`, `hours` (≥ 0, 2 decimals), `recordedBy`, `finalized` (default false), `finalizedAt`, `finalizedBy` | unique `assignmentId` |
| `audit_log` | `actorId`, `action` (`insert` \| `update` \| `export`…), `collection`, `recordId`, `before`, `after`, `createdAt` | insert only |

- `audit_log.before`/`after` are snapshots of the record. They never include `passwordHash` or `sessions`.
- A volunteer's total hours and completed activity count are **computed** from finalized attendance (an aggregation), never stored.
- v1 left a `users` collection in Atlas (volunteer accounts). v2 does not read or write it. Leave it in place until the team decides.

## Business rules (enforced in the API)

Mongo has no triggers, so every write goes through shared service functions in `server/`, never ad hoc queries in a route handler.

1. **No hard deletes** of volunteers, activities, assignments, or staff. Deactivate or cancel.
2. **Capacity:** an activity never has more `assigned` assignments than `capacity`, with no race condition. Use a transaction or an atomic conditional update, never a read then write.
3. Only `open` activities and `active` volunteers can be assigned.
4. A volunteer can't be assigned to two activities that overlap in time.
5. Once attendance is `finalized`, only an admin can change it, and the change is audit logged.
6. `hours` can't exceed the activity's duration; `checkOutAt` must be after `checkInAt`.
7. Every change listed under "Audit log" above writes to `audit_log`.
8. Cancelling an activity keeps its assignments and attendance.

## Screens (Android)

`NativeTabs` for staff: **Inicio** (dashboard), **Voluntarios**, **Actividades**, **Reportes**, **Ajustes** (profile and logout; staff management and the audit log for admins only). Tabs a role can't use are hidden, and the API refuses the request anyway. An activity's detail has three sections: Detalles, Participantes, Asistencia. Wide tables become searchable lists, cards, and detail screens.

## Context files

_Nested context files, if any get created for a specific part of the codebase, are listed here._
