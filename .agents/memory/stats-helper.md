---
name: weeklyProgress/streakDays pattern
description: Real-time profile stats must be computed from analyses, never hardcoded to 0
---

Both GET /profile and GET /auth/me must compute real weeklyProgress and streakDays.

The shared helper is `artifacts/api-server/src/lib/stats.ts` → `computeProfileStats(userId)`.
It queries completed analyses and returns `{ streak, weeklyProgress }`.

**Why:** profile.ts had formatProfile() hardcode both to 0, causing the home screen weekly
progress bar and streak badge to always show empty for every user regardless of activity.

**How to apply:** Any endpoint that returns a profile object must await computeProfileStats
and pass the result to formatProfile(row, streak, weeklyProgress).
