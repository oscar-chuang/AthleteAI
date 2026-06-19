# AthleteAI — Architecture

## System overview

```
┌─────────────────────────────────────────────────────┐
│  Expo mobile app  (artifacts/athlete-mobile)        │
│  expo-router screens · React Query hooks · SVG      │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS / JSON (API_URL)
┌───────────────────▼─────────────────────────────────┐
│  Express 5 API  (artifacts/api-server, port 8080)   │
│  auth · analyses · chat · profile · progress        │
└──────────┬──────────────────────┬───────────────────┘
           │ Drizzle ORM          │ Anthropic SDK
┌──────────▼──────────┐  ┌───────▼───────────────────┐
│  PostgreSQL          │  │  Claude (claude-3-5-sonnet) │
│  (DATABASE_URL)      │  │  sport detection · tips    │
└──────────────────────┘  └───────────────────────────┘
```

## Package responsibilities

| Package | Responsibility |
|---------|---------------|
| `artifacts/athlete-mobile` | All user-facing screens, navigation, pose scanning |
| `artifacts/api-server` | Auth, CRUD, AI orchestration, biomechanics grounding |
| `lib/db` | Drizzle schema, migrations, `db` + `pool` exports |
| `lib/api-spec` | `openapi.yaml` — single source of truth for API shape |
| `lib/api-client-react` | Generated React Query hooks (do not edit manually) |
| `lib/api-zod` | Generated Zod request/response schemas (do not edit manually) |
| `artifacts/mockup-sandbox` | Isolated Vite dev server for UI prototyping on the canvas |

## Pose analysis pipeline (device-side)

1. User selects athlete in the video (tap to set crop).
2. A hidden WebView loads `pose.js` (MediaPipe Pose + custom scan logic).
3. WebView scans the video at the locked crop — no per-frame crop updates.
4. Per-joint worst frames are captured: `{ time, landmarks[33], jpeg, deg, lvl }`.
5. On `scanComplete`, the native layer receives `{ angles, risks, frame }`.
6. If `Object.values(angles)` has ≥1 finite number → PATCH the analysis.
7. If empty (model failed) → show "couldn't detect the athlete" fallback.

## Biomechanics grounding flow (server-side)

```
PATCH /analyses/:id  { jointAngles, jointRisks, frameBase64 }
    ↓
Server calls Claude with joint data + sport context
    ↓
Claude returns structured tips (injury + performance) grounded in angles
    ↓
Tips written to DB; biomechanicsApplied = true
    ↓
Mobile polls GET /analyses/:id until biomechanicsApplied
    ↓
Grounded tips replace measured-fallback cards
```

Once `biomechanicsApplied = true`, subsequent PATCHes with joint data are rejected — Claude's tips are not overwritten by a re-scan.

## Auth

JWT, 30-day expiry, stored in AsyncStorage (`auth_token`). A global 401 handler in `artifacts/athlete-mobile/lib/api.ts` auto-clears the token and redirects to login. No OAuth.

## Database schema (key tables)

| Table | Key columns |
|-------|-------------|
| `users` | `id`, `email`, `passwordHash`, `createdAt` |
| `profiles` | `userId`, `name`, `sport`, `level`, `goals`, `weeklyGoal` |
| `analyses` | `id`, `userId`, `sport`, `status`, `jointAngles`, `jointRisks`, `biomechanicsApplied`, `overallScore` |
| `chat_messages` | `id`, `userId`, `role`, `content`, `referencedAnalysisId` |

Full schema: `lib/db/src/schema/`.

## Operational alerts

### `thumbnail_resize_failed`

**What it means:** The `resizeThumbnail()` helper in `artifacts/api-server/src/lib/resize-thumbnail.ts` could not down-sample a video frame with sharp. The original (potentially large) base64 string was written to the DB unchanged to avoid losing the frame entirely.

**Common causes:**
- The mobile client sent a corrupt or non-JPEG/PNG byte sequence.
- The frame buffer is valid but contains an unusual colour-space or sub-sampling mode sharp does not support.
- An upstream dependency (sharp / libvips) crashed on a specific pixel layout.

**Fields included in the alert:**
| Field | Meaning |
|-------|---------|
| `error` | The underlying sharp error message |
| `inputBytes` | Approximate raw byte size of the failing frame |
| `inputKB` | `inputBytes / 1024` for quick triage |

**How to respond:**
1. Check the `inputKB` value. Frames under 200 KB are almost certainly corrupt input; frames over 1 MB suggest the client is sending uncompressed or very high-resolution data.
2. Inspect recent PATCH requests to `/analyses/:id` for the `frameBase64` field — look for unusual MIME types or encoding errors.
3. If the issue is systematic (many alerts in a short window), consider adding a byte-size guard in the PATCH route to reject oversized frames before they reach sharp.
4. If it is a one-off, no action is needed — the fallback path ensures the analysis is not lost.

**Alerting sink:** Configured via `ALERT_WEBHOOK_URL` (Slack-compatible webhook). An in-process counter is always incremented regardless; the counter is accessible via `getAlertCounter("thumbnail_resize_failed")` from `lib/alerting.ts` if you add an internal metrics endpoint.

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `lib/db` | Primary Postgres connection (Replit-provisioned) |
| `JWT_SECRET` | `api-server` | Token signing |
| `ANTHROPIC_API_KEY` | `api-server` | Claude API |
| `EXPO_PUBLIC_DOMAIN` | `athlete-mobile` | Constructs API base URL inside Replit |
| `EXPO_PUBLIC_API_URL` | `athlete-mobile` | Override API URL (production / Railway) |

See `.env.example` for all variables and how to generate them.
