---
name: API server typecheck state
description: Current state of api-server TypeScript checking
---
As of June 2026, `pnpm run typecheck` AND isolated `pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit` are both FULLY CLEAN. The previously-noted `@workspace/db` "has no exported member" errors (analysesTable/profilesTable/usersTable/chatMessagesTable) no longer reproduce — the db package declarations now resolve under tsc.

**How to apply:** Do NOT preemptively dismiss api-server tsc errors as "pre-existing and ignorable" — typecheck is green, so any error you see is real and likely yours. Investigate it.
