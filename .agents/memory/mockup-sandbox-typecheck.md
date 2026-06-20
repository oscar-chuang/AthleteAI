---
name: mockup-sandbox typecheck fixes
description: How to fix React 19 ref type errors in mockup-sandbox UI components
---

The mockup-sandbox has its own `node_modules/react` (19.x) but shares `@types/react`
from the workspace root. This causes "Two different types with this name exist, but they
are unrelated" errors for `VoidOrUndefinedOnly` in any component that touches `ref`.

**How to apply:**
- `skipLibCheck: true` in `tsconfig.json` suppresses `.d.ts`-level errors but NOT
  errors in `.tsx` source files — not sufficient alone.
- For `ref` props that just need to pass through: use `Omit<ComponentProps<"svg">, "ref">`.
- For third-party `rootRef` props (e.g. react-day-picker): cast with `ref={rootRef as any}`.
- Together with `skipLibCheck: true`, this eliminates all typecheck errors.

**Why:**
pnpm hoists the workspace-root React types but each artifact can have its own React
runtime install, producing duplicate `VoidOrUndefinedOnly` symbol conflicts in the tsc
type graph. The only clean fix without restructuring the monorepo is `skipLibCheck` +
targeted `any` casts in the affected components.
