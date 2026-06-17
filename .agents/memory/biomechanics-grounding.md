---
name: Biomechanics tip grounding contract
description: Cross-file design decisions that keep AI coaching tips synced to the scanned pose skeleton, and the async-lifecycle lesson behind them
---

# Biomechanics tip grounding

Coaching tips in the skeleton screen's injury/performance sections must correspond to
the *scanned* pose, not generic create-time AI output. Two durable decisions enforce
this — treat them as a contract when touching analysis tips.

## Decision 1 — `analyses.biomechanicsApplied` is the source of truth for "grounded"
- The create-time AI write is CONDITIONAL (only `WHERE biomechanicsApplied = false`);
  the biomechanics PATCH writes unconditionally and sets the flag true.
- **Why:** the two analyses run concurrently and can resolve out of order. Without the
  conditional write, a slower create-time response clobbers the grounded tips a
  biomechanics PATCH already landed. Any new tip-writing path must respect this flag.

## Decision 2 — the client gates "grounded" tips on a `groundedReady` state
- Server injury/performance tips render only once grounded; otherwise the injury
  section falls back to a card built purely from the measured scan result — never
  stale create-time tips.
- **Why:** showing generic tips before the scan grounds them makes the skeleton
  highlight describe the wrong thing and destroys user trust.

## Lesson — the skeleton screen is REUSED across route id changes
An expo-router param change does NOT remount this component, so an in-flight load/poll
from a previous analysis will write its tips onto the new screen unless guarded.
- **How to apply:** guard every async state write with BOTH a per-effect `cancelled`
  flag (loads) AND a current-id token compared to the analysisId (polls). Reset
  grounded state in the id-scoped effect only — never in the broad video/sport effect,
  which would clobber an already-grounded load.

## Decision 3 — PATCH /analyses/:id is overloaded; a sport-only correction must NOT re-run AI
- The endpoint accepts either measured scan data (joint angles/risks/frame → grounded
  re-run) OR a sport-only correction (just persists `sport`, no AI) OR rejects with 400.
- A sport-only correction deliberately defers the re-run to the next skeleton scan, which
  reads the corrected sport and does the single authoritative grounded run.
- **Why:** there is NO guard protecting one biomechanics run from another (Decision 1 only
  guards create-time vs biomechanics). If a sport switch kicked off its own biomechanics
  re-run, it would race the skeleton's grounded run and could clobber the joint-grounded
  result. Two biomechanics runs on the same row is the unprotected case — avoid creating it.
- **How to apply:** never start a biomechanics run (isBiomechanics=true) with no joint/frame
  data — it wrongly sets `biomechanicsApplied=true` with empty measurements. Keep the 400
  guard for empty payloads.

## Lesson — currentIdRef does NOT protect re-scans of the SAME analysis
Re-scanning the same analysis while a previous biomechanics poll is in flight shares the
id, so the id guard passes and an older poll can clobber the newer scan. Clearing
`pollRef`'s timeout can't stop an already-dispatched network request.
- **How to apply:** add a monotonic per-scan run token (`runTokenRef`), capture it at the
  start of each `runBiomechanics` call, and require token-still-latest in EVERY async
  continuation (update.then, poll.then/.catch, outer .catch) alongside the mount+id checks.
