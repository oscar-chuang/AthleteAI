---
name: Skeleton screen web fix
description: Platform.OS==='web' must skip FileSystem operations in the skeleton screen; use source={{ html }} not source={{ uri: fileUri }}.
---

The skeleton screen (`app/analysis/skeleton/[id].tsx`) prepares a self-contained HTML file with MediaPipe + video and loads it in a WebView.

**The problem on web:** `expo-file-system` operations (writeAsStringAsync, copyAsync, cacheDirectory) are no-ops or fail silently on Expo web. The resulting `htmlFileUri` is never set, so the WebView never renders.

**The fix:** Added an early-return branch in the `useEffect` for `Platform.OS === 'web'`:
- Skips all FileSystem work
- Calls `buildHtml(videoUri)` directly and stores the result in a new `webHtml` state variable
- Sets `preparing = false` immediately

In the `mediaBlock` render:
- `Platform.OS === 'web'` → `<WebView source={{ html: webHtml }} .../>` (HTML injected as srcdoc — MediaPipe CDN scripts load fine from a srcdoc iframe)
- Native → existing file:// URI path unchanged

**Video on web:** The `videoUri` on Expo web is typically a blob URL (e.g. `blob:https://...`) from ImagePicker. Blob URLs are accessible from srcdoc iframes that share the same origin — so the video should load. If it doesn't (cross-origin srcdoc), the MediaPipe UI still renders and shows the empty-state message.

**Why:** `source={{ uri: "file:///..." }}` is meaningless in a browser; `source={{ html: "..." }}` injects HTML as srcdoc which works correctly.
