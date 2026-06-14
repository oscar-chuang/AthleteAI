---
name: Expo quirks and patterns
description: Non-obvious Expo/React Native patterns in this project
---

# Expo quirks

## File system import
Use `import * as FileSystem from "expo-file-system/legacy"` for expo-file-system v19.

## allAnalyses for activity tracking
Home screen needs ALL analyses (not just top 3) for 7-day activity dots.
Store as `allAnalyses` state; `uploadedAt.split("T")[0]` gives the date string for comparison.
`recentAnalyses = analyses.slice(0, 3)` is kept separately for the recent sessions list.

## Period filtering in progress
`filteredEntries = useMemo(...)` filters by `entry.date` (ISO string) against a cutoff date.
Entries come oldest-first from the API (needed for chart chronological order).
`sessionLog = [...filteredEntries].reverse()` gives newest-first for the session log display.

## Pre-existing TS error
`app/auth/login.tsx` has a pre-existing route type error — not related to new changes, ignore.

## Sports list (20 sports)
Weightlifting, Running, Basketball, Golf, Tennis, Swimming, CrossFit, Boxing, Soccer,
Gymnastics, Cycling, Fencing, Rowing, Volleyball, Baseball, Wrestling, Rugby, Hockey, Yoga, Other
Each needs an entry in SPORT_ACCENT (analyze.tsx) and optionally SPORT_ICONS (progress.tsx).
