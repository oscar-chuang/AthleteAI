---
name: AthleteAI logo component
description: The canonical logo component — SVG "A" with three volt-green dots — replaces the old Feather "zap" icon.
---

The logo is `components/ui/Logo.tsx` — an SVG React component.

**Design:** Letter "A" in white (#F5F5F5) on dark rounded-square background (#111316), with three volt-green (#C6FF3A) circular dots at the apex and both feet of the A. The dots represent motion-capture tracking markers, fitting for a sports-AI app.

**Props:** `size?: number` (default 40). The component scales all geometry proportionally.

**Where applied:** Landing page (`app/index.tsx`), login (`app/auth/login.tsx`), signup (`app/auth/signup.tsx`).

**Why:** User confirmed the "A with green dots" design. The old bolt (Feather "zap" inside a tinted rounded box) was replaced with this SVG in all three screens.

**How to apply:** Import `{ Logo } from "@/components/ui/Logo"` and render `<Logo size={N} />`. Remove any `logoIcon` wrapper View and associated StyleSheet entry.
