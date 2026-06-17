---
name: API Architecture Decisions
description: Key decisions around chat route, profile storage, and analysis personalization in the AthleteAI API server.
---

## Profile storage
- `profiles` table uses `userId` as a unique FK (one profile per user).
- GET `/api/profile` returns `null` profile (not 404) if user hasn't completed onboarding — mobile handles null gracefully.
- PATCH `/api/profile` does an upsert (insert if not exists, update if exists) — safe to call from onboarding repeatedly.
- Subscription is hardcoded as free-tier default until RevenueCat is wired up. Do not block on this.

**Why:** The profile was fully stubbed (returning null) before this was built. Onboarding data was being collected but silently discarded.

## Chat route
- Chat history stored in `chat_messages` table (userId FK, role, content, optional referencedAnalysisId).
- On every POST /chat, the system prompt is rebuilt dynamically from the user's current profile + last 5 completed analyses.
- Uses `claude-opus-4-5`, max_tokens 1024 (concise coaching responses, not essays).
- History limit: last 40 messages sent to Claude for context window management.
- DELETE /chat clears all messages for that user.

**Why:** The chat tab existed in the UI but the /chat route was missing entirely — every send was returning 404.

## Analysis personalization
- `analyzeAthletePerformance` in `anthropic.ts` accepts an optional `AthleteProfile` (level, goals, injuryConcerns).
- The analyses route fetches the user's profile row from DB before calling Claude and passes it as context.
- "No current injuries" is filtered out before passing to Claude (it's the default no-op selection in onboarding).

**Why:** Without profile context, Claude generated generic advice. With level/goals/injury history, tips are calibrated to the actual athlete.

## In-app recording
- Uses `ImagePicker.launchCameraAsync` from `expo-image-picker` (already installed, no new dep needed).
- Max duration: 60 seconds. Quality: 0.8.
- After recording, flows into the same sport-picker modal as upload — same submit path.
- Web platform shows an alert (not available on web).
