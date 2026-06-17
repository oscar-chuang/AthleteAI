---
name: Mobile tab refresh pattern
description: How to refresh data on every tab focus in Expo Router
---
`useFocusEffect(useCallback(() => { loadData(); }, [loadData]))` fires on initial mount AND every tab focus. Replaces the need for a separate `useEffect` for initial load on tab screens. Pair with a polling `useEffect` for processing states.

**Why:** Tab-based apps need data to be fresh when user navigates back; useEffect only fires on mount.
**How to apply:** All tab screens (index, analyze, progress, compare) use useFocusEffect for data loading.
