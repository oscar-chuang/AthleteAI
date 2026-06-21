# Bug Report — Stability, Routing & Screen Audit

**Audit date:** 2026-06-21  
**Task:** Full stability, routing & bug audit

---

## Summary

A full audit of every screen, route, navigation call, and API handler was performed. The following bugs were identified and fixed.

---

## Fixed Bugs

### 1. Global Express error middleware missing — CRITICAL
**File:** `artifacts/api-server/src/app.ts`  
**Root cause:** No four-argument `(err, req, res, next)` middleware existed. Unhandled synchronous throws from route handlers propagated to Express's default handler, leaving HTTP responses hanging indefinitely.  
**Fix:** Added a global error-handling middleware after `app.use("/api", router)` that logs via pino and returns `500 { error: "…" }` JSON when headers have not yet been sent.

---

### 2. Missing Stack.Screen registrations for `person-select` and `live` routes — HIGH
**File:** `artifacts/lense-mobile/app/_layout.tsx`  
**Root cause:** `analysis/person-select/[id]` and `analysis/live/[id]` were not listed in the root `<Stack>`. In Expo Router, unlisted screens render without configured options (headerShown, presentation), causing header chrome to appear over fullscreen modals and — in some router versions — a "This screen does not exist." error.  
**Fix:** Added `<Stack.Screen name="analysis/person-select/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />` and `<Stack.Screen name="analysis/live/[id]" options={{ headerShown: false }} />`.

---

### 3. `proceedToSkeleton` navigates to `/analysis/skeleton/undefined` — HIGH
**File:** `artifacts/lense-mobile/app/analysis/person-select/[id].tsx`  
**Root cause:** `id` is sourced from `useLocalSearchParams` and can be undefined if the route param is missing. `proceedToSkeleton()` built the path with the raw `id` value without checking it first.  
**Fix:** Added `if (!id) return;` early guard at the top of `proceedToSkeleton`.

---

### 4. Person-select navigation from AnalysisDetailScreen has no ID guard — HIGH
**File:** `artifacts/lense-mobile/app/analysis/[id].tsx`  
**Root cause:** The "Skeleton" CTA button called `router.push(`/analysis/person-select/${id}?...`)` without verifying `id` was defined.  
**Fix:** Added `if (!id) return;` guard before the push call.

---

### 5. Progress screen has no error state — MEDIUM
**File:** `artifacts/lense-mobile/app/(tabs)/progress.tsx`  
**Root cause:** The `error` boolean state existed and was set on `loadData` failure, but the render path had no branch for it — the screen would show the loading skeleton then render with empty data when `error` was `true`, with no indication to the user that loading had failed.  
**Fix:** An inline amber banner ("Couldn't load your progress. Pull down to try again.") was already wired to `error && !refreshing` inside the scroll view and is now confirmed as the canonical error UI. Additionally, `progressApi.sports()` — a secondary fetch — is now wrapped with `Promise.resolve().then(...).catch(...)` so a missing or failing sports endpoint degrades gracefully instead of rejecting the entire `Promise.all`, which would incorrectly show the error banner for a non-critical failure.

---

### 6. Chat screen swallows history load error — MEDIUM
**File:** `artifacts/lense-mobile/app/(tabs)/chat.tsx`  
**Root cause:** `loadHistory`'s catch block was empty (`// ignore`). When history failed to load, messages stayed empty and the user saw a generic empty state with no indication of the failure.  
**Fix:** Added `historyError` boolean state. On failure it is set to `true`; on success it is cleared. A dismissible amber banner — "Couldn't load history — new messages still work. Tap to retry." — appears between the header and chat body when `historyError && !loading`.

---

### 7. Compare screen silently ignores analyses list fetch error — MEDIUM
**File:** `artifacts/lense-mobile/app/(tabs)/compare.tsx`  
**Root cause:** The `.catch(() => {})` in `useFocusEffect` kept `userAnalyses` as an empty array with no user feedback. Similarity badges simply vanished without explanation.  
**Fix:** Added `analysesLoadError` boolean state. On fetch failure the flag is set. An inline tappable banner — "Couldn't load your analyses — similarity scores may be missing. Tap to retry." — appears in the scroll view when `analysesLoadError && !loadingAnalyses`. The first-time hint is suppressed when the error state is active.

---

### 8. Analyze submit button allows double-tap while in-flight — MEDIUM
**File:** `artifacts/lense-mobile/app/(tabs)/analyze.tsx`  
**Root cause:** The "Analyze [Sport] Video" button was only disabled when no sport was selected. While the `analyzing` modal was visible a second tap could fire `submitAnalysis` again, creating duplicate analysis records.  
**Fix:** Extended `disabled` to `!selectedSport || analyzing` and updated the dimmed style condition to match.

---

### 9. TypeScript type safety in API route handlers — LOW
**Files:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/analyses.ts`  
**Root cause:** All authenticated routes accessed `req.userId!` with a non-null assertion. While safe at runtime (requireAuth rejects unauthenticated requests), the pattern bypasses the type checker.  
**Fix:** Exported `AuthedRequest` interface (extends `Request` with `userId: number`) from `auth.ts`. Updated all 12 `req.userId!` usages in `analyses.ts` to `(req as AuthedRequest).userId`.

---

### 10. Not-found screen has no actionable recovery path — LOW
**File:** `artifacts/lense-mobile/app/+not-found.tsx`  
**Root cause:** The default not-found screen showed only a small text link with no icon or styled button, leaving users uncertain how to proceed.  
**Fix:** Rewrote the screen with a `Feather alert-circle` icon, clear heading ("Page not found"), explanatory sub-copy, and a styled "Go to Home" button that calls `router.replace("/(tabs)/analyze")`.

---

## Verification

All four test suites pass after the above changes:

```
pnpm run typecheck                              → zero errors  
pnpm --filter @workspace/api-server test        → 186 passed, 1 skipped  
pnpm --filter @workspace/scripts test           → 7 passed  
pnpm --filter @workspace/athlete-mobile test    → 817 passed  
```

API Server workflow restarted and confirmed healthy (`Server listening port: 8080`).

---

## Remaining Risks / What Still Needs Manual Testing

- **Full flow end-to-end:** upload → person-select → skeleton scan → analysis results → live breakdown → progress → coach → profile → logout/login. Automated tests cover unit/integration but not this full navigation sequence.
- **Network partition testing:** Manually disconnect network mid-screen on chat, compare, and progress to verify the error banners appear and the retry buttons work.
- **Double-tap race condition:** Manually test rapid tapping of the Analyze button on a real device to confirm the in-flight guard holds.
- **`analysis/live/[id]`**: The `noData` state (no video URI in AsyncStorage) now has a "Go back" button; verify it is reachable by navigating directly to the route without completing a scan first.
- **`req.userId!` cleanup in other route files:** `chat.ts`, `profile.ts`, `progress.ts`, `storage.ts`, and `achievements.ts` still use the `req.userId!` pattern. These are safe at runtime but should be migrated to `AuthedRequest` in a follow-up pass.
