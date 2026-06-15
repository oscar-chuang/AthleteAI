---
name: Biomechanics tip grounding contract
description: How AI coaching tips are kept in sync with the scanned pose skeleton across the API server and the skeleton screen
---

# Biomechanics tip grounding

Coaching tips shown in the skeleton screen's injury/performance sections must
correspond to the *scanned* pose, not generic create-time AI output. A cross-file
contract enforces this.

## Server (routes/analyses.ts, anthropic.ts)
- `analyses.biomechanicsApplied` (boolean, default false) marks that tips were
  regenerated from the real joint angles/risks measured by the on-device pose scan.
- Create-time AI write is CONDITIONAL: writes tips only `WHERE biomechanicsApplied
  = false`, so a slower create-time analysis can never clobber grounded tips that a
  biomechanics PATCH already landed.
- The biomechanics PATCH path writes unconditionally and sets
  `biomechanicsApplied = true`.
- Tips carry `joints?: string[]` (whitelist enum: leftKnee/rightKnee/leftHip/
  rightHip/leftElbow/rightElbow) so each tip can highlight the exact landmarks it
  refers to. MediaPipe indices: leftKnee 25, rightKnee 26, leftHip 23, rightHip 24,
  leftElbow 13, rightElbow 14.

## Skeleton screen (app/analysis/skeleton/[id].tsx)
- `groundedReady` gates whether server injury/performance tips render. Set true only
  when (a) the post-scan poll observes `biomechanicsApplied===true`, or (b) initial
  load of an already-grounded analysis. Reset false ONLY in the id-scoped load effect.
- If not grounded, the injury section falls back to a measured card built purely from
  the scan result (angles/risks/worstTime) — never stale create-time AI tips. The
  okCard and worstSummary are always driven by measured scanResult, independent of
  groundedReady.
- Tapping a tip seeks the worst frame and calls the WebView
  `window.__highlightJoints(keys, ms)` to pulse the matching landmarks.

**Why:** Users must trust that a tip describes what the skeleton shows. A race
between the create-time and biomechanics analyses, or showing generic tips before the
scan grounds them, breaks that trust.

## Async lifecycle guard (important)
The skeleton screen is REUSED across route id changes — an expo-router param change
does NOT remount the component. Any async load/poll must guard its writes with BOTH a
per-effect `cancelled` flag AND a `currentIdRef` token compared against the
analysisId, or an in-flight poll/GET from a previous analysis will write tips for the
wrong screen.

**How to apply:** When adding async state writes here, check
`currentIdRef.current === analysisId` (poll/biomechanics) or the effect's `cancelled`
flag (load) before every setState.
