---
name: Skeleton screen architecture & invariants
description: How the lense-mobile pose/skeleton screen works and what must never break when editing it.
---

# Skeleton / pose-overlay screen (`artifacts/lense-mobile/app/analysis/skeleton/[id].tsx`)

## Core design decision: scan-once-then-freeze
The screen renders the skeleton over a FROZEN frame, never live video tracking during viewing.
A hidden WebView runs MediaPipe ONCE over the user-selected crop, captures per-joint worst
frames (crop-local 33 landmarks + downscaled crop JPEG + per-joint deg/lvl), posts them over the
bridge, then is unmounted. Native render uses expo-image + react-native-svg from the stored
landmarks on a static image.

**Why:** the original live-tracking overlay would switch from the user-selected athlete to a
different person on replay / loop / crossing / occlusion. With no live tracking during viewing,
person-switching is structurally impossible. Prefer false negatives (lose the athlete on a frame)
over wrong-person (snap to a bystander).

**Crop is LOCKED ONCE, then never moved.** An earlier in-scan "crop-follow" that chased the
athlete with a 30%-jump guard was NOT enough — it could still drift/snap to a bystander frame by
frame. The crop is now pinned: from `INIT_CROP` when the user selected one, else auto-locked onto
the first reliably detected person, and `focusNX/NY/cropHalf*` are NEVER updated afterwards. Do not
reintroduce any per-frame focus chasing — that is the exact bug this design exists to kill.

## Must-not-break lifecycle contract
- Route params: `id, nx, ny, nw, nh, highlightJoint`. Crop comes from person-select via `router.replace`.
- `AsyncStorage` key `video_uri_${id}` holds the local video URI; the HTML build copies the video
  into cacheDir and grants the WebView file access.
- WebView `meta` message sets the video aspect ratio.
- On scan end the screen PATCHes the analysis with EXACTLY `{ jointAngles, jointRisks, frameBase64 }`
  (full-frame worst JPEG for the server/Claude), then polls `analyses.get` until
  `analysis.biomechanicsApplied` before swapping in grounded tips.
- Poll race guards: `currentIdRef` (different analyses) + `runTokenRef` (re-scan of same id). An
  in-flight poll from a previous id/scan must never write tips/groundedReady for the current one.
- Already-grounded revisit (`biomechanicsApplied` true at load) shows grounded tips immediately,
  and the revisit re-scan must NOT re-run biomechanics (skip `runBiomechanics` when `groundedReady`)
  or the refining spinner flickers over the grounded tips.
- No-video path must not crash; if PATCH/poll fail, show a measured-fallback card (never stale tips).
- Scanner FAILURE paths (pose.js onerror, `pose.initialize().catch`, `video.error`, watchdog) still
  post a `scanComplete`, but with empty angles (`{}` after JSON drops undefined props). The RN side
  must gate on a real measurement (`Object.values(angles).some(finite number)`) before
  `setScanResult`/PATCH — otherwise it grounds tips on a pose that was never measured and shows a
  bogus "all safe" card. On no measurement, let the hero fall back to "couldn't detect the athlete".
- On `id` change reset `setVideoUri(undefined)` first: the HTML-build effect is keyed on video/sport
  (not id), so without this two analyses sharing a URI/sport keep stale scan state, and the scanner
  could build with the previous analysis's video.

## Angle/risk math (keep identical so PATCH stays consistent)
`ang(a,b,c)` = interior angle; `lvl(a, loRisk, loWarn, hiWarn, hiRisk)` → 0 safe / 1 caution / 2 risk.
Per-sport thresholds in `SPORT_THRESHOLD_DB`. Tracked joints → MediaPipe landmark indices:
leftKnee 25, rightKnee 26, leftHip 23, rightHip 24, leftElbow 13, rightElbow 14.

## Ask Coach handoff
Store the message string in AsyncStorage key `pendingChatMessage`, then `router.push("/(tabs)/chat")`.
Chat consumes it in a `useFocusEffect` and auto-sends after history loads.

## Tests
- vitest (`__tests__/*.test.ts`, node env) for pure helpers in `utils/`.
- jest-expo (`app/**/__tests__/**`) renders the screen; mock api/webview/expo modules and drive the
  WebView `onMessage` to simulate scan events. Preserve the grounding-lifecycle invariants above.
