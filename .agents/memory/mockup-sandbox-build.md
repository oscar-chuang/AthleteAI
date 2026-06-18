---
name: mockup-sandbox build exclusion
description: Why mockup-sandbox has no build script and must not have one added.
---

# mockup-sandbox build exclusion

`artifacts/mockup-sandbox` is a dev-only design tool (Vite component preview server). Its `vite.config.ts` requires the `PORT` environment variable at build time. Adding a `build` script causes `pnpm run build` (which runs `pnpm -r --if-present run build` across all packages) to fail with "PORT environment variable is required."

**Why:** The mockup-sandbox is never deployed to production, so there is nothing to build.

**How to apply:** If a `"build": "vite build"` script ever appears in `artifacts/mockup-sandbox/package.json`, remove it. Keep only `dev`, `preview`, and `typecheck`.
