---
name: Fake-timer + async act() hang (React 19)
description: setImmediate must be in doNotFake or await act(async()=>{}) stalls forever.
---

# Fake-timer + async act() hang (React 19)

## Rule
Any describe block that calls `jest.useFakeTimers()` AND uses `await act(async()=>{})` (or the `flush()` helper) **must** add `setImmediate` and `clearImmediate` to `doNotFake`. Otherwise the test stalls indefinitely.

```ts
jest.useFakeTimers({
  doNotFake: ["MessageChannel", "setImmediate", "clearImmediate"] as any,
});
```

The `as any` cast is required because Jest's TypeScript types for `doNotFake` don't include all valid runtime names.

**Why:** React 19's `async act()` implementation defers its internal scheduler flush via `setImmediate`. When `setImmediate` is captured by fake timers, every `await act(async () => {})` call waits for a `setImmediate` callback that never fires — producing a silent hang lasting 30–60 s until the test timeout kills the worker.

`setTimeout` and `setInterval` can remain faked; only `setImmediate` / `clearImmediate` (and optionally `MessageChannel` for the scheduler) need to be real.

**How to apply:** Whenever you add or review a `jest.useFakeTimers()` call in `artifacts/lense-mobile`, check whether the describe block also calls `await act(async()=>{})` or a `flush()` helper that wraps it. If so, upgrade the call to the doNotFake form above.
