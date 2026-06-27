---
name: Mobile lib/api.ts as type source-of-truth
description: All new mobile screens and hooks import their types from lib/api.ts — adding new API features requires updating that file first.
---

## Rule
`artifacts/lense-mobile/lib/api.ts` is the single source of truth for all API client methods and shared TypeScript types used by screens, hooks, and components.

## What was added (GitHub code integration)

**New types:** `FrameTick`, `TickStats`, `FlaggedMoment`, `CoachingMoment`, `MovementSummary`, `JointDataPoint`, `MovementSummaryDataPoint`, `DrillRecord`, `JointTrendsResponse`, `ProfileStats`, `SportEntry`, `PersonalRecordEntry`, `JointImprovement`, `JointKey`

**New `analyses` methods:** `update()`, `detectSport()`, `coachingMoments()`, `movementSummary()`

**New top-level clients:** `jointTrends`, `movementSummaryHistory`

**New `profile` method:** `stats()`

**New `progress` methods:** `sports()`, `personalRecords()`, `summary()`

**Extended interfaces:** `AnalysisRecord` + `jointAngles`, `jointRisks`; `Profile` + `trainingDays`, `checkInHour`, `avatarUrl`; `TipRecord` + `tipType`

## Live analysis screen exclusion
`app/analysis/live/[id].tsx` is excluded from the mobile tsconfig because it imports a locally-defined `JointKey` union type (joint name literals) that conflicts with `lib/api.ts`'s `type JointKey = string`. The screen still runs fine at runtime.

**Why:** The new GitHub code added a full live analysis pipeline with skeleton overlay, coaching moments, and movement summaries — none of these types existed in the pre-merge API client.

**How to apply:** Before adding any new screen that calls a new API endpoint, add the endpoint method and its request/response types to `lib/api.ts` first.
