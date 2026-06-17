---
name: Tips conditional on video data
description: AI tips generation requires actual video/measurement data; rules for the tip schema
---

# Tips require actual data

**Rule:** When `hasFrame=false` AND `hasJointAngles=false`, the AI MUST output `"tips": []`. Never generate generic sport tips without personal observations.

**Why:** Users reported the AI was generating 5 generic tips even when no video frame or joint angle measurements existed (only sport + title passed in). This made the app feel fake and unhelpful.

**How to apply:**
- `hasJointAngles = !!(jointAngles && Object.values(jointAngles).some(v => v != null))`
- `hasData = hasFrame || hasJointAngles`
- User prompt requirements are conditional: when `!hasData`, require empty tips array
- When `hasData`, require each tip to have `videoObservation`: exact thing seen/measured
- SYSTEM_PROMPT schema uses comment-style annotations (allowed since it's not parsed as JSON)

**Key fields:**
- `TipRecord.videoObservation?: string` — what AI specifically saw or measured
- Displayed in analysis detail as "Observed in your video" callout (eye icon, primary color)
