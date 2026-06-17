---
name: Auto-send pending chat message
description: Pattern for auto-sending a pre-populated message from analysis detail to chat tab
---
When navigating from analysis detail to chat via "Ask Coach", the pending message is stored in AsyncStorage key `pendingChatMessage`. In chat.tsx, useFocusEffect reads it and calls `sendMessage(pending)` with a 600ms setTimeout to allow history to finish loading first. sendMessage is a hoisted async function declaration so it's accessible in the callback closure.

**Why:** Just setting setInput(pending) only fills the field — user had to manually tap send. Auto-send delivers instant coaching response.
**How to apply:** Only use this pattern for pre-composed targeted messages from other screens. Regular user input still goes through the manual send flow.
