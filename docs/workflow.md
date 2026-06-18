# AthleteAI — Task Workflow Rules

This document defines how every task (built by agents or manually) is handled
from start to finish. The goal is a production branch that is always stable and
always reflects the latest approved work.

---

## The lifecycle of every task

```
Build → Test → Merge to main → Checkpoint → (optionally) Queue follow-up tasks
```

1. **Build in isolation.** Each task runs in its own branch / isolated
   environment. Main is never touched until the task is verified clean.

2. **Test before merge.** Before a task can be merged the agent must:
   - Run `pnpm run typecheck` — zero errors required.
   - Run `pnpm --filter @workspace/api-server test` — all tests green.
   - Run `pnpm --filter @workspace/athlete-mobile test` — all tests green.
   - Restart the API server and confirm it starts without errors.

3. **Merge to main immediately.** Completed, tested work is applied to the
   main branch straight away — never left in a draft, temporary branch, or
   unreviewed state.

4. **Checkpoint after every successful merge.** A checkpoint is created
   automatically after each task merge so you can roll back to any known-good
   state in seconds.

5. **If a task breaks the app, stop and roll back.** If the post-merge
   typecheck or tests fail, or the API server errors on startup, the change is
   rolled back to the previous checkpoint before any new work begins.

---

## Follow-up task rules

After each task the agent proposes follow-up tasks. These are automatically
queued and built **only when they meet all of the criteria below**.

### Auto-build criteria (all must be true)
- Improves the app for users: better UX, bug fix, performance gain, or
  completing a partially-built feature.
- Does **not** touch a safety gate (see below).
- Does **not** introduce a new unrelated feature that the user hasn't asked for.
- Is a single, focused unit of work (not a bundle of unrelated things).

### Safety gates — always stop and ask before building
Any task that touches one of the following areas requires explicit confirmation
before work begins:

| Area | Examples |
|------|---------|
| **Payments / billing** | Stripe, RevenueCat, subscription logic, pricing |
| **Authentication** | Login flow, JWT handling, token storage, Clerk/Auth changes |
| **Database schema** | New columns, dropped columns, renamed tables, new migrations |
| **File / data deletion** | Deleting DB rows in bulk, removing uploaded files, purging storage |
| **Major redesigns** | Full screen or layout overhaul that changes the UX significantly |
| **Third-party credentials** | New API keys, OAuth integrations, secrets |

For everything else (UI copy, styling, empty states, test coverage, minor
feature additions, bug fixes): **build automatically**.

---

## Task priority order

When multiple follow-up tasks are queued, build in this order:

1. **Crash / regression fixes** — anything that broke in the last task
2. **Test gaps** on freshly-merged code
3. **Incomplete scope** from the previous task
4. **UX / polish** improvements
5. **New features** that directly extend the current user flow
6. **Tech debt** that would block a future task

---

## What is NOT built automatically

- Features unrelated to the current product domain.
- Tasks that are purely cosmetic with no user-facing impact.
- Duplicate tasks (already covered by a pending task in the list).
- Tasks that conflict with an existing architecture decision in `replit.md`.
- Anything requiring the user's personal credentials, payment info, or
  third-party account access.

---

## Checkpoint naming convention

Each checkpoint message summarises: **what changed + current app state**.
Format: `feat/fix/refactor: <short description> — all tests green`.

---

## When things go wrong

| Symptom | Action |
|---------|--------|
| typecheck fails after merge | Roll back to previous checkpoint; fix in a new task |
| API server won't start | Check for port collision first; roll back if code is at fault |
| Tests regress | Do not merge; fix inline if trivial, new task if complex |
| Post-merge setup fails (drizzle push hangs) | `DATABASE_URL` precedence issue — see `docs/architecture.md` |

---

*Last updated: 2026-06-18*
