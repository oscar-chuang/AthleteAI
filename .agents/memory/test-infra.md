---
name: Test infrastructure
description: Vitest setup in lense-mobile and api-server — what's tested and how to run.
---

# Test infrastructure

## lense-mobile — pure unit tests
- **Runner**: Vitest (vitest.config.mts, env: node)
- **Command**: `pnpm --filter @workspace/lense-mobile run test`
- **Test file**: `artifacts/lense-mobile/__tests__/analysisUtils.test.ts`
- **Tests cover**: `computeFlaggedJoints` + `computeWorstLvl` in `utils/analysisUtils.ts`
  - Safe/caution/high-risk joint filtering, worst-first sort, worstLvl max, combined contract invariants.
- **Why separate**: Pure functions with zero Expo/RN deps; no mocking needed.

## api-server — DB integration tests
- **Runner**: Vitest (vitest.config.ts, env: node)
- **Command**: `pnpm --filter @workspace/api-server run test`
- **Test file**: `artifacts/api-server/src/__tests__/biomechanics.test.ts`
- **Tests cover**: the two SQL WHERE clause patterns in `runAIAnalysis` (routes/analyses.ts):
  1. Create-time conditional (`WHERE biomechanicsApplied = false`) — no-op when already grounded.
  2. Biomechanics unconditional (`WHERE id = X`) — always succeeds.
  3. Create-time failure handler cannot demote a grounded analysis to "failed".
- **Uses real dev DB** (DATABASE_URL) — tests real Postgres semantics, not mocked queries.
  - Requires at least one row in `users` table (log in once first).
  - Creates/deletes analysis rows in beforeEach/afterEach.

**Why:** The mocking complexity of drizzle's fluent API outweighs the isolation benefit;
real DB tests catch actual SQL semantics — that's the invariant that matters.
