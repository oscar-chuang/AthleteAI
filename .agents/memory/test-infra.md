---
name: Test infra (vitest + jest-expo)
description: The test surfaces guarding the biomechanics-grounding contract — two runners, what each covers, and the setup gotchas.
---

There is no single shared test runner. Two runners coexist; the package `test`
scripts (run by the `test-mobile-utils` / `test-api-biomechanics` workflows) drive them.

## api-server — vitest (`pnpm --filter @workspace/api-server run test`)
- `vitest.config.ts` includes `src/**/*.test.ts`, so it picks up both files below.
- `src/__tests__/biomechanics.test.ts` — **real dev-DB integration**: exercises the two
  SQL WHERE patterns in `runAIAnalysis` (create-time `WHERE biomechanicsApplied=false`
  no-ops once grounded; biomechanics `WHERE id=X` always lands; a failed create-time run
  cannot demote a grounded analysis). Needs `DATABASE_URL` + at least one `users` row.
- `src/routes/analyses.test.ts` — **mocked, supertest-driven race test**: an in-memory db
  fake that genuinely applies WHERE predicates + mocked anthropic (test-controlled
  deferreds) + mocked auth, forcing the create-time vs biomechanics runs to resolve
  out of order.
  - `vi.mock` factories are hoisted above all top-level code, so shared mock state
    (the db store, the AI deferreds) must live inside `vi.hoisted(() => {...})` or you get
    `Cannot access 'x' before initialization`.
  - vitest isolates module mocks per file, so this file's `@workspace/db` mock does not
    leak into the real-DB integration test.

## lense-mobile — vitest AND jest-expo (`test` = `vitest run && jest`)
- `vitest.config.mts` includes `__tests__/**/*.test.ts` (note `.ts`, top-level only) →
  `__tests__/analysisUtils.test.ts`, pure-unit tests of `computeFlaggedJoints` /
  `computeWorstLvl` in `utils/analysisUtils.ts` (no Expo/RN deps, env: node).
- `jest.config.js` (preset `jest-expo`) `testMatch` is scoped to `**/app/**/__tests__/**`
  so jest only runs `app/analysis/skeleton/__tests__/grounding.test.tsx` and does NOT
  grab the top-level vitest unit test (and vitest's `.ts`-only glob ignores the `.tsx`
  component test). **The two globs must stay disjoint or each runner fails on the other's files.**
- `grounding.test.tsx` renders the skeleton screen with mocked
  webview/api/storage/router/orientation/file-system and asserts the full grounding
  lifecycle (first-scan success, PATCH/GET-timeout fallback, grounded revisit, rapid-nav guard).
  - jest mock factories can only close over vars prefixed `mock` (babel-plugin-jest-hoist).
  - **jest-expo + fake timers: the FIRST test absorbs cold-start overhead** and blows the
    default 5s timeout when the full suite runs, even though it passes in isolation (~1.8s).
    Fix is `testTimeout: 30000` in `jest.config.js`, not per-test waits. If a mobile test
    times out only alongside others, suspect cold-start, not a hang — confirm with `-t` in isolation.
  - Drive lifecycle by mocking `react-native-webview` to capture `props.onMessage`, then
    emit `{type:'angles'}` (modelReady) and a `scanComplete` message with `risks`; step the
    poll with fake timers (`jest.advanceTimersByTime`: 2000ms first, then 1800ms retries up to 20).
