# Volunt-App

## What this is

A mobile app for Banco de Alimentos de Guadalajara (BAMX) that lets volunteers register, view and sign up for shifts, check in to activities, and track their volunteer hours. BAMX administrators manage activities, registrations, attendance, and hours from the same system. Built for TC2005B.502, Grupo 402.

Read `scope.md` before building anything — it's the living plan, broken into features, tracking what's done versus what's still open. Keep it up to date as you go: that's how a fresh conversation, or a teammate, picks this up without anyone re-explaining the project.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code. This project is on Expo SDK 57 with the new `NativeTabs` API (`expo-router/unstable-native-tabs`), not the classic `Tabs`. General Expo knowledge may be stale for this version — check the version-specific docs rather than assuming.

## How to work

Before building anything, decide what you're doing and why, in a few plain sentences. Don't write code yet at that point. Report the decision, then stop and wait — don't move on to building until told to go ahead.

If something genuinely forks — where a reasonable person could go two different ways and it matters which — ask, one question at a time, with two or three concrete options. Most things don't need asking; decide those and say what you decided.

Then build it. If the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Break a build step into its own short checklist in `scope.md`, and check items off as they're finished.

## Rules

- Strict TypeScript, no `any`.
- File-based routing lives in `src/app` only — Expo Router convention. `@/*` resolves to `src/*` (see `tsconfig.json`).
- Shared UI belongs in `src/components`, not copy-pasted across screens.
- No secrets in source. Real values go in `.env` (gitignored); `.env.example` documents what's needed. Only `EXPO_PUBLIC_`-prefixed vars are safe client-side — a service-role or admin key never goes in this app.
- Validate all user input, in the UI and wherever the backend receives it.
- Never show a raw exception or backend error to a volunteer or admin — a plain, human sentence, always.
- Comments only where they explain something non-obvious.
- No test runner for this project. Verify manually: run it in the simulator/Expo Go and walk the real flow.
- Feature branches only. Before merging into `main`, another team member reviews the change and confirms the main functionality still works.

## Data model

See `scope.md`'s Data model feature for the actual entities (Volunteer, Activity/Shift, Registration, Attendance, Hours) and their relationships — that's the source of truth, don't invent fields here.

## Roles

Three roles: Volunteer, BAMX Administrator, Technical Administrator. A volunteer only ever sees their own data; admin screens require an authenticated admin role.

## Context files

_Nested context files, if any get created for a specific part of the codebase, are listed here._