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
