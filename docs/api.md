# AthleteAI — API Reference

Base URL (dev): `http://localhost:8080/api`  
Base URL (prod): set `EXPO_PUBLIC_API_URL` in the mobile app.

All protected routes require `Authorization: Bearer <token>`.

## Auth

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| POST | `/auth/signup` | `{ email, password, name? }` | `{ token, user }` | 201 on success, 409 if email exists |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` | 401 on bad creds |
| GET | `/auth/me` | — | `{ user, profile, subscription }` | Returns computed `weeklyProgress` + `streakDays` |

## Profile

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/profile` | — | `{ profile, subscription }` |
| PATCH | `/profile` | `Partial<Profile>` | `{ profile }` |
| GET | `/profile/stats` | — | `{ streak, totalAnalyses, thisWeekCount, personalBests, latestScore, scoreDelta }` |

## Analyses

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| GET | `/analyses` | — | `{ analyses[] }` | Ordered newest-first |
| POST | `/analyses` | `{ title, sport, videoUrl?, duration? }` | `{ analysis }` | Creates pending analysis |
| GET | `/analyses/:id` | — | `{ analysis, tips[], injuryRisks[] }` | Includes Claude-grounded tips if `biomechanicsApplied` |
| PATCH | `/analyses/:id` | `{ jointAngles?, jointRisks?, frameBase64?, sport? }` | `{ success }` | Joint data triggers AI grounding; rejected if already grounded |
| DELETE | `/analyses/:id` | — | `{ success }` | |
| POST | `/analyses/detect-sport` | `{ imageBase64 }` | `{ sport }` | Claude vision, ~3 s |

### Biomechanics PATCH contract

```json
{
  "jointAngles": {
    "leftKnee": 142.3,
    "rightKnee": 138.1,
    "leftHip": 91.4,
    "rightHip": 88.7,
    "leftElbow": 165.2,
    "rightElbow": 170.0
  },
  "jointRisks": {
    "leftKnee": 2,
    "rightKnee": 1,
    "leftHip": 0,
    "rightHip": 0,
    "leftElbow": 0,
    "rightElbow": 0
  },
  "frameBase64": "<base64-encoded JPEG of the worst-risk frame>"
}
```

Risk levels: `0` = safe, `1` = caution, `2` = high risk.

## Chat

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/chat` | — | `{ messages[] }` |
| POST | `/chat` | `{ content, referencedAnalysisId? }` | `{ userMessage, assistantMessage }` |
| DELETE | `/chat` | — | `{ success }` |
| GET | `/chat/suggestions` | — | `{ suggestions[] }` |

## Progress

| Method | Path | Response |
|--------|------|----------|
| GET | `/progress` | `{ entries[] }` — one entry per completed analysis with scores |

## Achievements

| Method | Path | Response |
|--------|------|----------|
| GET | `/achievements` | `{ achievements[] }` — with `progress`, `total`, `unlocked` |

## Subscriptions

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/subscriptions/plans` | — | `{ plans[] }` |
| GET | `/subscriptions/current` | — | `{ subscription, plan }` |
| POST | `/subscriptions/update` | `{ tier, revenueCatCustomerId? }` | `{ subscription }` |

## Storage

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| POST | `/storage/upload-url` | `{ filename, contentType }` | `{ uploadUrl, objectKey }` | Pre-signed PUT URL |
| DELETE | `/storage/object` | `{ objectKey }` | `{ success }` | |

## OpenAPI spec

The canonical spec lives at `lib/api-spec/openapi.yaml`. After any changes:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react` (React Query hooks) and `lib/api-zod` (Zod schemas). Do not edit generated files manually.
