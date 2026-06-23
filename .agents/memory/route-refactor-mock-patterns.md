---
name: Route refactor mock patterns
description: Patterns for vitest mocks when refactoring shared helpers into routes — orderBy chaining and module mock completeness.
---

## Rule
When a test mock's `orderBy()` previously returned a raw Promise (consuming the queue), refactoring routes to chain `.orderBy().limit(n)` breaks the mock silently (TypeError: limit is not a function → 500 in test).

**How to fix:** Make `orderBy()` consume the queue entry synchronously AND return a dual-use thenable:
```js
orderBy: () => {
  const rows = rowsForCurrentCall(); // consume queue NOW (synchronous, preserves order)
  return {
    limit: (n) => ({ then(res, rej) { return Promise.resolve(rows.slice(0, n)).then(res, rej); } }),
    then(res, rej)  { return Promise.resolve(rows).then(res, rej); },
  };
},
```

## Rule
When moving exports from a route file into a shared lib (e.g. `compressAvatarIfNeeded` from `routes/profile.ts` → `lib/media.ts`), always grep for test imports of the old path and update them.

## Rule
When importing a constant (e.g. `JOINT_KEYS`) via a vi.mock("../lib/anthropic"), that mock must explicitly re-export the constant. Without it the import resolves to undefined and causes TypeError at runtime in the test.

**Why:** vi.mock factory replaces the entire module; only what the factory returns is visible. Constants defined in the real module are not forwarded automatically.
