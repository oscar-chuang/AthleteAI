---
name: Color token migration — legacy → design system
description: The #00C2FF / #1DB954 legacy palette was replaced with design-system tokens. Test mocks and preset keys must use the new values.
---

## Rule

All legacy hex colors in the mobile app have been migrated to design-system tokens:

| Legacy | New token | Value |
|--------|-----------|-------|
| `#00C2FF` | `colors.primary` | `#2F7BFF` |
| `#1DB954` | `colors.success` | `#22C55E` |
| `#06b6d4` | `colors.primary` | `#2F7BFF` |
| `#FF6B35` | **KEEP** — semantic energy/medium-confidence color | `#FF6B35` |

`#FF6B35` is intentional (scan confidence badge, streak indicator) — do not replace it.

**Why:** The UI redesign (#669) adopted a single Performance Blue accent (`#2F7BFF`) and a unified success green (`#22C55E`). Old cyan/green accents created visual noise.

**How to apply:**
- Profile-settings preset keys: `"preset:#2F7BFF"`, `"preset:#22C55E"` (not the old hex values)
- Test mocks that stub `useColors`: update `primary` / `success` to the new values, then update any `.toBe("#00C2FF")` / `.toBe("#1DB954")` assertions to use the mock's color values
- `skeleton/[id].tsx` drill/ok card styles: use `#22C55E` variants, not `#1DB954`
