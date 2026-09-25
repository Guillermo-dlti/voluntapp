# Coding standards

The conventions this codebase follows. `AGENTS.md` states the short version;
this is the long version — it names, for each rule, whether a tool actually
enforces it or it's left to the reader's judgment.

## Running it

| Command | What it does |
|---|---|
| `npx expo start` | Development server. |
| `npx expo lint` | ESLint over the project. |
| `npx tsc --noEmit` | Type-check without emitting output. |

There's no dedicated `typecheck` or `format` script in `package.json` yet, and
Prettier isn't installed. Worth deciding on soon (see `scope.md`) — until then,
run the two commands above by hand before calling a change done.

There is no test runner and no pre-commit hook. For a four-person team
committing to the same repo, that's a real gap worth closing, not a permanent
decision like the "no test runner" choice below.

## Enforced (once ESLint config is filled in)

- **Strict TypeScript, no `any`.** `tsconfig.json` already has `strict: true`.
  If a library doesn't expose a type you need, write a narrow typed wrapper
  around that one call site instead of letting `any` spread outward.

## Judgment (nobody catches these but a reader)

- **Routes live in `src/app` only.** Expo Router won't pick up a screen
  anywhere else, and it's confusing for teammates looking for one.

- **Shared UI is a component, not a copy-paste.** If the same card, button
  style, or list row shows up in more than one screen, it belongs in
  `src/components`. Two copies is a coincidence; three is a pattern that
  should have been a component from the start.

- **No secrets in source, ever.** Real values go in `.env` (gitignored).
  `EXPO_PUBLIC_`-prefixed vars ship in the client bundle — fine for a public
  API URL or an anon key, never for anything meant to stay server-side.

- **Validate input at the boundary.** A required field in the UI isn't the
  same as the backend trusting it — once there's a real backend, validate
  there too.

- **Never surface a raw error.** A failed request, a bad response, a crash in
  a data fetch — all of it becomes a plain sentence a volunteer or admin can
  understand, never a stack trace or raw HTTP status on screen.

- **Comments explain the non-obvious.** Why a check-in code expires, why
  hours only count after admin validation — worth a comment. Restating what
  the line already says is not.

- **Code review before merging to `main`.** Per the team's own Stage 1 plan:
  another member reviews the change and confirms the main functionality still
  works. Feature branches, not direct commits to `main`.

- **Manual verification only.** No test runner — a deliberate choice given
  the team's size and timeline, not a gap to fill later. Verify by running
  the app and walking the real flow: register → view shifts → sign up →
  check in → see hours update.
  *v2 note:* this was the v1 rule and v1 flow. The v2 flow to walk is the MVP
  demo flow in `scope.md`. v2 feature 8 (Hardening) needs automated tests
  where each role tries forbidden actions, so this rule gets revisited there.

## Language

- **UI text in Spanish (es-MX).** Every label, button, empty state, and error
  message staff see is in Mexican Spanish. Use `usted`/neutral phrasing
  consistently once the team picks one; don't mix.
- **Code, comments, and commits in English.** Identifiers, file names,
  comments, commit messages, and PR descriptions.

## Comments

- **Say what and why.** When a comment is worth writing (see "Comments explain
  the non-obvious" above), it says what the code does *and* why it does it that
  way. Example: "Conditional update instead of read-then-write, so two
  coordinators assigning the last spot at the same time can't both succeed."

## Git workflow

- **Conventional commits.** `type: short summary` in the imperative, English:
  `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. Add a scope when it
  helps (`feat(volunteers): add deactivate endpoint`). Small, logical commits.
- **One feature per branch**, named `feature/<name>` (for example
  `feature/staff-auth`); bug fixes use `fix/<name>`, docs-only changes
  `docs/<name>`. Never commit directly to `main`.
- **PR review before merging.** Every branch goes into `main` through a pull
  request that another team member reviews, and the reviewer confirms the
  main flow still works. Nobody merges their own unreviewed PR.

## When a rule and the code disagree

Say so and fix the rule, not just the code. This file and `scope.md` are both
meant to be corrected in place when building proves them wrong. Quietly
working around a documented rule is the one thing that makes these documents
worthless.