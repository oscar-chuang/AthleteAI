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

## Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `lib/db` | Primary Postgres connection (Replit-provisioned) |
| `JWT_SECRET` | `api-server` | Token signing |
| `ANTHROPIC_API_KEY` | `api-server` | Claude API |
| `EXPO_PUBLIC_DOMAIN` | `athlete-mobile` | Constructs API base URL inside Replit |
| `EXPO_PUBLIC_API_URL` | `athlete-mobile` | Override API URL (production / Railway) |

See `.env.example` for all variables and how to generate them.
