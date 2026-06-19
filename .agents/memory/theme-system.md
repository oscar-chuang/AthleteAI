---
name: Theme system & AsyncStorage Jest mock
description: ThemeContext architecture, file locations, and the Jest fix needed when AsyncStorage enters the import chain.
---

# Theme System

## Architecture
- `constants/colors.ts` exports `darkTheme` and `lightTheme` (both full token sets). The old `colors.light` alias still exists pointing to `darkTheme` for backward compat.
- `lib/themeContext.tsx` — ThemeProvider + useTheme hook. Persists to AsyncStorage under key `"theme_mode"`. Default = `"dark"`.
- `hooks/useColors.ts` — now thin: just returns `useTheme().colors`. Every screen that calls `useColors()` automatically gets the right theme.
- `app/_layout.tsx` — ThemeProvider wraps everything (outside AuthProvider and QueryClientProvider).
- `app/profile-settings.tsx` — Display section (near bottom of scroll) has the moon/sun toggle calling `useTheme().toggleTheme`.

## Jest / AsyncStorage
When `themeContext.tsx` enters the import chain of a test (even indirectly via `profile-settings.tsx`), Jest fails to load `@react-native-async-storage/async-storage` with a native-module error.

**Fix:** Add to `jest.config.js` → `moduleNameMapper`:
```js
"^@react-native-async-storage/async-storage$":
  "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js"
```

**Why:** AsyncStorage's own package ships a jest mock at that path. The moduleNameMapper intercepts the import before Jest tries to load the native module.
