---
name: Pre-existing API TypeScript errors
description: Known TS errors in api-server that do not affect runtime
---
Module '@workspace/db' has no exported member 'analysesTable' (and profilesTable, usersTable, chatMessagesTable) — these are pre-existing errors from a workspace package resolution issue in tsc. esbuild compiles correctly so the server runs fine. Do not try to fix these during feature work; they require a db package restructure.

**Why:** @workspace/db type re-exports don't match what tsc resolves, but esbuild resolves them correctly at runtime.
**How to apply:** Ignore tsc errors from `pnpm typecheck` on api-server — they are not caused by your changes.
