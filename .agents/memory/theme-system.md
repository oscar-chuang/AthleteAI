---
name: Theme system & AsyncStorage Jest mock
description: ThemeContext architecture, file locations, accent palette system, and the Jest fix needed when AsyncStorage enters the import chain.
---

# Theme System

## Architecture
- `constants/colors.ts` — defines `AccentKey` type, `ACCENT_PALETTES` record (midnight/ocean/sunset/forest), `DEFAULT_ACCENT = "midnight"`, and `buildDarkTheme(accent)` / `buildLightTheme(accent)` factory functions. `darkTheme` / `lightTheme` named exports are still present (built with default accent) for backward compat. The old `colors.light` alias still exists pointing to `darkTheme`.
- `lib/themeContext.tsx` — ThemeProvider + useTheme hook. Persists mode to `"theme_mode"` and accent to `"theme_accent"` in AsyncStorage. Default = dark mode + midnight accent. Context now exposes `accentColor: AccentKey` and `setAccentColor(key)` alongside `mode`, `isDark`, `toggleTheme`, `setMode`.
- `hooks/useColors.ts` — thin wrapper: returns `useTheme().colors`. Every screen that calls `useColors()` automatically gets the right theme + accent.
- `app/_layout.tsx` — ThemeProvider wraps everything (outside AuthProvider and QueryClientProvider).
- `app/profile-settings.tsx` — Display section has the moon/sun toggle + a row of 4 accent swatches (Midnight/Ocean/Sunset/Forest) with labels. Tapping a swatch calls `setAccentColor(key)` which rebuilds colors immediately.

## Accent palette design
Each accent key only overrides `primary`, `accent`, and `tint` tokens; all background/surface/text tokens come from the base dark/light theme. This keeps changes minimal and all existing `colors.primary` references pick up the new accent automatically.

## Jest / AsyncStorage
When `themeContext.tsx` enters the import chain of a test (even indirectly via `profile-settings.tsx`), Jest fails to load `@react-native-async-storage/async-storage` with a native-module error.

**Fix:** Add to `jest.config.js` → `moduleNameMapper`:
```js
"^@react-native-async-storage/async-storage$":
  "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js"
```

**Why:** AsyncStorage's own package ships a jest mock at that path. The moduleNameMapper intercepts the import before Jest tries to load the native module.
