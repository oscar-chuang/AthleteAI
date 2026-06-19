# AthleteAI

AI-powered sports coaching that turns any training video into measurable biomechanical feedback, injury-risk scores, and personalised drills.

## Run & Operate

```bash
pnpm install                                    # install all workspace deps
pnpm run typecheck                              # full typecheck (all packages)
pnpm run build                                  # typecheck + build all packages
```

**Per-service dev:**
```bash
pnpm --filter @workspace/api-server run dev     # API server  →  :8080
pnpm --filter @workspace/athlete-mobile run dev # Expo mobile app
```

**Tests:**
```bash
pnpm --filter @workspace/api-server test        # vitest — biomechanics grounding contract
pnpm --filter @workspace/athlete-mobile test    # vitest + jest-expo — skeleton screen lifecycle
pnpm --filter @workspace/scripts test           # vitest — backfill thumbnail resize + idempotency
```

**DB & codegen:**
```bash
pnpm --filter @workspace/db run push            # push Drizzle schema → DATABASE_URL (dev only)
pnpm --filter @workspace/api-spec run codegen   # regenerate React Query hooks + Zod schemas from OpenAPI
```

**Required env:** `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY` — see `.env.example`.

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo SDK 54, React Native, expo-router |
| API | Express 5, Node.js 24, TypeScript 5.9 |
| DB | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| AI | Anthropic Claude (via API) |
| Pose analysis | MediaPipe (runs in a WebView, results sent to native layer) |
| Build | esbuild (API CJS bundle), Expo build (mobile) |
| API codegen | Orval (from `lib/api-spec/openapi.yaml`) |
| Monorepo | pnpm workspaces |

## Where things live

```
artifacts/
  api-server/       Express 5 API — src/routes/ for endpoints, src/index.ts for server setup
  athlete-mobile/   Expo mobile app — app/ (expo-router screens), components/, lib/, utils/
  mockup-sandbox/   Vite dev server for UI component prototyping on the canvas

lib/
  api-spec/         openapi.yaml — single source of truth for the API contract
  api-client-react/ Generated React Query hooks (do not edit; run codegen)
  api-zod/          Generated Zod schemas (do not edit; run codegen)
  db/               Drizzle schema (src/schema/) + migrations (drizzle/)

scripts/            Workspace-level scripts (post-merge, build helpers)
docs/               Product, architecture, API reference, roadmap
```

**Source-of-truth files:**
- DB schema → `lib/db/src/schema/`
- API contract → `lib/api-spec/openapi.yaml`
- Theme / colors → `artifacts/athlete-mobile/constants/colors.ts`
- DB connection → `lib/db/src/index.ts` (prefers `DATABASE_URL`)

## Architecture decisions

- **Scan-once-then-freeze:** MediaPipe runs once in a hidden WebView over a locked crop, posts captured landmarks + per-joint worst-frame JPEGs to the native layer, then unmounts. Native render uses static expo-image + react-native-svg. This makes person-switching structurally impossible.
- **DATABASE_URL before SUPABASE_DATABASE_URL:** `lib/db/src/index.ts` prefers the Replit-provisioned Postgres. The Supabase project is no longer reachable (ENOTFOUND); do not flip the precedence back.
- **OpenAPI as contract:** All API shape changes go through `lib/api-spec/openapi.yaml` first, then `pnpm --filter @workspace/api-spec run codegen` regenerates hooks and schemas. Never write `fetch` calls by hand in the mobile app.
- **biomechanicsApplied guard:** Once an analysis row has `biomechanicsApplied = true`, PATCH requests for joint data are rejected. This prevents a re-scan from overwriting Claude-grounded coaching tips.
- **Auth is JWT-only:** No OAuth. Tokens live in AsyncStorage (`auth_token`). A global 401 handler in `lib/api.ts` auto-clears the token and redirects to login.

## Product

Upload a training video → the app identifies your sport, runs pose estimation, extracts per-joint angles and injury-risk levels, then sends the data to Claude which generates sport-specific coaching tips grounded in the measured biomechanics. Tips are colour-coded by joint, tied to drills, and linked to peer-reviewed sources. Progress is tracked across sessions.

Core loop: **Upload → Analyse → Review skeleton overlay → Ask Coach → Track progress.**

## User preferences

- Keep server/AI/DB schema changes minimal and deliberate — the biomechanics PATCH contract (`jointAngles`, `jointRisks`, `frameBase64`) must stay byte-identical unless the OpenAPI spec is updated first.
- DATABASE_URL is the canonical database; do not switch back to SUPABASE_DATABASE_URL.

## Gotchas

- **DB precedence:** `lib/db/src/index.ts` must use `DATABASE_URL || SUPABASE_DATABASE_URL` (Replit DB first). Flipping this back to Supabase-first causes every route to 500 — the Supabase host is unreachable.
- **Crop lock:** The skeleton screen locks the crop once on first person selection. Never reintroduce per-frame crop-following — it causes the skeleton to snap to bystanders.
- **Always run codegen after spec changes:** `lib/api-client-react` and `lib/api-zod` are generated; edits are overwritten next time codegen runs.
- **pnpm-lock.yaml is auto-managed:** Run `pnpm install` after adding/removing packages or renaming workspace packages. Do not hand-edit the lockfile.
- **Mobile test command:** `pnpm --filter @workspace/athlete-mobile test` runs `vitest run && jest` (both suites).

## Docs

See `docs/` for deeper dives:
- `docs/product.md` — user stories, core loop, personas
- `docs/architecture.md` — system design, data flow, package responsibilities
- `docs/api.md` — endpoint reference and auth
- `docs/roadmap.md` — planned features and priorities
- `docs/workflow.md` — task lifecycle, follow-up rules, safety gates

---

## AGENT RULES — read this before writing any code

These rules are mandatory for every task agent and for the main agent.
They are not suggestions. Violating them breaks the production branch.

### Mandatory post-task checklist

Every task — no exceptions — must complete all five steps before marking done:

1. **Typecheck:** `pnpm run typecheck` — zero errors allowed.
2. **API tests:** `pnpm --filter @workspace/api-server test` — all green.
3. **Scripts tests:** `pnpm --filter @workspace/scripts test` — all green.
4. **Mobile tests:** `pnpm --filter @workspace/athlete-mobile test` — all green.
5. **Server restart:** restart the `artifacts/api-server: API Server` workflow and confirm it starts without errors (watch for `EADDRINUSE` or missing-module crashes).
6. **Merge to main immediately:** do not leave finished, tested work in a branch or draft state.

A checkpoint is created automatically after every successful merge. If any step above fails, do not merge — fix the failure first, or roll back to the previous checkpoint.

### Follow-up task classification

When proposing or deciding whether to build a follow-up task, classify it using exactly one of these labels:

#### BUILD — proceed automatically
No approval needed. Build, test, merge, checkpoint.

| Category | Examples |
|----------|---------|
| Bug fix | Crash on screen load, broken API call, wrong data displayed |
| UX / polish | Empty states, loading skeletons, copy improvements, spacing, accessibility |
| Performance | Faster queries, smaller payloads, reduced re-renders |
| Incomplete scope | A feature the current task started but deliberately deferred |
| Test coverage | Unit or integration tests for code that was just merged |
| Minor feature extension | Adding a field, a filter chip, a sort option to an existing screen |

#### ASK FIRST — stop and confirm with the user before building
Do not start work until the user explicitly approves.

| Category | Examples |
|----------|---------|
| Payments / billing | Stripe, RevenueCat, subscription gating, pricing changes |
| Authentication | Login flow, JWT logic, token storage, Clerk/Auth changes, signup |
| Database schema | New columns, dropped columns, renamed tables, new migrations, index changes |
| Data deletion | Bulk-deleting DB rows, purging uploads, clearing user data |
| Major redesign | Full screen layout overhaul, navigation restructure, new design system |
| New third-party integration | Any new external API, OAuth provider, or secret/credential |
| Security-sensitive change | Rate limiting, CORS policy, auth middleware, input sanitisation |

#### REJECT — do not build
Decline and explain why.

| Category | Examples |
|----------|---------|
| Unrelated feature | Anything outside the AthleteAI domain (video coaching, biomechanics, progress tracking) |
| Conflicts with architecture | Re-introducing per-frame crop-following, switching DB back to Supabase, bypassing biomechanicsApplied guard |
| Already covered | Duplicate of a task already in the task list |
| Breaks a protected contract | Changing `jointAngles`/`jointRisks`/`frameBase64` shape without updating the OpenAPI spec first |

### If the app breaks after a merge

1. Stop all new work immediately.
2. Identify whether it is a code error or an environment issue (port collision, missing env var).
3. For code errors: roll back to the previous checkpoint and open a new task to fix the root cause.
4. For environment issues (e.g. `EADDRINUSE`): restart the affected workflow; do not roll back.
5. Do not merge any further tasks until the app is stable again.
