# 0003. Volunteer records: list, create, edit, deactivate, detail

**Date**: 2026-09-25
**Status**: Proposed

## Summary

Staff keep a record for each BAMX volunteer: contact details, an emergency contact, notes, and whether the person is active. Admins and coordinators can create, edit, deactivate, and reactivate records; supervisors can only read them. Nothing is ever deleted, every change goes to the audit log, and a volunteer's total hours are always calculated from finalized attendance, never typed in or stored.

## Requirements

**User stories**:
- As a coordinator, I want to register a volunteer and correct their details so that we can contact them and their emergency contact.
- As staff, I want to search volunteers by name, email, or phone and filter by status so that I find someone quickly on my phone.
- As a coordinator, I want to deactivate a volunteer who stopped coming, without losing their history.
- As staff, I want to open a volunteer and see their history and total hours.

**Acceptance criteria**:
- **AC-1**: Admin or coordinator creates a volunteer with first name, last name, phone, emergency contact name and phone (required) and optional email, birth date, notes. The record is saved with `status: active`, `createdBy` = the staff member, and an `insert` entry in `audit_log`.
- **AC-2**: Invalid input is rejected with field-level Spanish messages, both in the app (before sending) and by the API (400 with `fields`). Unknown fields are rejected.
- **AC-3**: A second volunteer with the same email (case and surrounding spaces ignored) is rejected with 409 and a plain message; volunteers without email never collide.
- **AC-4**: Admin or coordinator edits any field except `status`, `createdBy`, and dates; the change writes an `update` audit entry with before/after snapshots.
- **AC-5**: Admin or coordinator deactivates and reactivates a volunteer (status change only, never a delete), each with an `update` audit entry.
- **AC-6**: The list returns 20 volunteers per page sorted by last name then first name, filtered by status (`active` default, `inactive`, `all`) and by a search text that matches first name, last name, email, or phone (case-insensitive, at least 2 characters; the text is escaped, never used as a raw regex).
- **AC-7**: The detail returns the volunteer, their assignment history (activity name, dates, assignment status, attendance status and hours when present), and `totalHours` = sum of `hours` over **finalized** attendance of their assignments. Until features 3–4 exist this is an empty history and 0 hours.
- **AC-8**: Supervisors can list and view (including phone and emergency contact) but get 403 on create, edit, deactivate, reactivate; the app hides those actions for them. No session → 401.
- **AC-9**: Invalid ids return 404 with a plain message, never a crash or raw error.

## Decision

**Chosen option**: REST routes under `/api/volunteers` in a new `server/src/volunteers.ts`, guarded by `requireStaff`, and a stack of screens inside the Voluntarios tab.

Decisions approved by the team on 2026-09-25:
1. **Phone input**: staff may type a 10-digit Mexican number; the app adds `+52`. A number starting with `+` is kept as typed. The API only accepts the stored international format (`^\+[1-9]\d{7,14}$`), so the normalization lives in the app and the rule lives on the server.
2. **Birth date**: native date picker from `@expo/ui` (already installed, no new native dependency). Stored as a BSON date (date only, midnight UTC). Must be in the past and after 1900.
3. **Supervisors see personal data** (phone, emergency contact) read only, as the permission table in `AGENTS.md` says. Hiding it later is a change in one place (the detail/list projection).

## Feature design

**Data model**: the `volunteers` collection from `AGENTS.md` / `server/src/collections.ts` (validator and indexes already live). No schema change.

**Field rules** (server zod, mirrored in the app for early feedback):
| Field | Rule |
|---|---|
| firstName | trimmed, 1–60 chars, no control characters |
| lastName | trimmed, 1–80 chars, no control characters |
| phone | `^\+[1-9]\d{7,14}$` |
| email | optional; trimmed, lowercased, valid email, ≤ 254 |
| birthDate | optional; ISO date `YYYY-MM-DD`, after 1900-01-01, before today (America/Mexico_City) |
| emergencyContactName | trimmed, 1–100 chars |
| emergencyContactPhone | same rule as phone |
| notes | optional; ≤ 1000 chars |

On edit, sending an empty string for an optional field removes it (`$unset`).

**API surface**:
| Endpoint | Method | Capability | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|---|
| /api/volunteers | GET | volunteers.read | `q`, `status` (active\|inactive\|all), `page` (1+) | `volunteers[]` (id, firstName, lastName, phone, email, status), `page`, `hasMore` | 400, 401 |
| /api/volunteers | POST | volunteers.write | fields above | `volunteer` | 400, 401, 403, 409 |
| /api/volunteers/:id | GET | volunteers.read | | `volunteer`, `history[]`, `totalHours` | 401, 404 |
| /api/volunteers/:id | PATCH | volunteers.write | any editable field | `volunteer` | 400, 401, 403, 404, 409 |
| /api/volunteers/:id/status | POST | volunteers.write | `status` (active\|inactive) | `volunteer` | 400, 401, 403, 404 |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| create | status | always `active` (server) |
| create | createdBy | `currentStaff(response).id` |
| create/edit | createdAt/updatedAt | server clock |
| list | page size | constant 20 |
| detail | history | `assignments` for the volunteer joined with `activities` and `attendance` |
| detail | totalHours | sum of `attendance.hours` where `finalized: true`, over the volunteer's assignments, rounded to 2 decimals |
| audit | actorId | `currentStaff(response).id` |
| app | phone sent | typed number; 10 digits → `+52` + digits; starts with `+` → as typed |

**Key invariants**: no endpoint deletes; `status`, `createdBy`, and timestamps are never client-supplied; every write and its audit entry commit together (transaction or insert then audit with the same session); list and detail responses use explicit fields.

**Security model**: see `AGENTS.md` → Roles and permissions. The app mirrors write access with `roleCan` (add `editVolunteers`) only to hide actions.

**App screens** (`src/app/(tabs)/voluntarios/` becomes a folder with a Stack `_layout.tsx`):
- `index.tsx`: title, search field, status chips (Activos, Inactivos, Todos), list rows (initials, full name, phone, inactive tag), "Nuevo" action for admin/coordinator, pagination on scroll, empty and error states per `AGENTS.md` → Design.
- `nuevo.tsx` and `[id]/editar.tsx`: one shared form component in `src/components/volunteer-form.tsx`.
- `[id]/index.tsx`: contact, emergency contact, notes, status, total hours, history (empty state until feature 3), Edit and Deactivate/Reactivate actions for admin/coordinator, with a confirmation before deactivating.
- API client in `src/services/volunteers.ts`, reusing the auth token, timeout, and plain-message pattern from `src/services/auth.ts` (extract the shared request helper rather than copying it).

**Critical test scenarios**:
- Happy path: coordinator creates, finds by search, edits, deactivates, reactivates; each step audit logged, verifies **AC-1**, **AC-4**, **AC-5**, **AC-6**
- Failure: duplicate email 409; invalid phone 400 with field message, verifies **AC-2**, **AC-3**
- Permission: supervisor POST/PATCH/status → 403; no token → 401, verifies **AC-8**

## Build plan

1. Extract a shared authenticated request helper in the app (`src/services/api.ts`), satisfies **AC-2**, **AC-9**
2. `server/src/volunteers.ts`: zod schemas, list/search, create, edit, status, detail with history + totalHours aggregation, audit entries; mount in `app.ts`, satisfies **AC-1**–**AC-9**
3. API checks against Atlas for every AC, with temporary records cleaned up afterwards
4. App: Voluntarios stack, list with search/filters, shared form (phone normalization, `@expo/ui` date picker), detail with actions hidden by role, satisfies **AC-1**–**AC-8**
5. Walk the flow on the Android emulator as coordinator and as supervisor; update `scope.md`

## Consequences

- History and total hours only become meaningful once features 3 (assignments) and 4 (attendance) exist; the aggregation is written now against their collections so it doesn't change later.
- Search uses escaped case-insensitive regex, fine for BAMX's volume (thousands of records). A text index can replace it if it ever gets slow.
