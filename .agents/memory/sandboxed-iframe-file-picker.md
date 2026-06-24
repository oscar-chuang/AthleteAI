---
name: File picker in sandboxed iframes
description: How to make file upload work when the web app runs inside a sandboxed iframe (Replit preview).
---

## The rule

Never rely on programmatic `.click()` on a hidden `<input type="file">` in the Replit preview pane. Use a real, user-clicked `<input>` instead.

**Why:** Replit's preview is an iframe. Browsers apply the "user activation" requirement to file pickers: `.click()` called outside a synchronous user gesture is silently blocked. `expo-image-picker`'s `launchImageLibraryAsync` internally creates a hidden input and calls `.click()` — this fails in sandboxed iframes with no error and no feedback. Even calling it directly from an `async` button handler doesn't help once any `setState` or `await` has occurred.

**How to apply:** On web (`Platform.OS === "web"`), overlay a transparent `<input type="file">` absolutely over the upload button. The user's physical click hits the input directly — this always works even in sandboxed iframes.

```tsx
<TouchableOpacity style={s.uploadBtn} onPress={Platform.OS !== "web" ? handleUpload : undefined}>
  <Text>Upload Video</Text>
  {Platform.OS === "web" && (
    <input
      type="file"
      accept="video/*"
      onChange={(e: any) => {
        const file = e.target.files?.[0];
        if (file) handleWebFileUri(URL.createObjectURL(file));
        e.target.value = "";
      }}
      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" } as any}
    />
  )}
</TouchableOpacity>
```

Add a `handleWebFileUri(uri: string)` function to the upload hook that takes the blob URL and starts the normal flow (sport picker, etc.).
