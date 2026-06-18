# AthleteAI — Roadmap

## Now (core loop hardening)

- [ ] **Before/after frame overlay** — side-by-side or swipe comparison of the "safe" vs "risk" frame for each joint
- [ ] **Exact joint angles on video** — render the measured degree value as a callout label next to each joint dot on the frozen skeleton
- [ ] **Confidence score** — MediaPipe landmark visibility scores averaged per joint; surface as a "scan quality" indicator so users know when to re-record
- [ ] **"Why this matters" explanations** — one-sentence plain-English explanation per tip explaining the biomechanical mechanism, not just the risk label
- [ ] **One drill tied to one problem** — each high-risk tip surfaces exactly one targeted drill with a clear name, rep/set suggestion, and cue

## Next (product depth)

- [ ] **Video trimming / clip selection** — let users select the best 5–10 s clip before scanning, to improve pose detection accuracy
- [ ] **Side-by-side pro comparison** — overlay the user's joint angles against reference ranges for their sport and level
- [ ] **Multi-set tracking** — for strength athletes, capture joint angles across multiple reps and show consistency variance
- [ ] **Coach portal** — separate view for a human coach to review athlete analyses and add manual annotations
- [ ] **Push notifications** — weekly training reminder + "your analysis is ready" notification

## Later (monetisation + scale)

- [ ] **Subscription tiers** — free (3 analyses/month) / pro (unlimited + priority AI) / elite (+ coach access)
- [ ] **RevenueCat integration** — in-app purchase for iOS/Android
- [ ] **Video storage** — move from URL-based to object storage (R2/S3) with pre-signed upload URLs; currently only metadata is stored
- [ ] **Offline-first** — queue analyses when offline, sync on reconnect
- [ ] **Web app** — a lightweight react-vite companion for coaches and desktop users

## Technical debt

- [ ] **Remove mock/demo analyses** — replace seeded demo data with proper empty-state onboarding
- [ ] **Error boundary on skeleton screen** — catch WebView crashes gracefully and show a retry UI
- [ ] **Rate limiting** — add per-user rate limits on the AI endpoints (detect-sport, chat, biomechanics grounding)
- [ ] **Structured logging** — replace ad-hoc console.log with the existing Pino logger throughout all routes
