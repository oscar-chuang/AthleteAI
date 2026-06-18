# AthleteAI — Product

## One-line pitch

Upload any training video. Get measurable biomechanical feedback, injury-risk scores, and one personalised drill — backed by peer-reviewed sports science.

## Core loop

```
Upload video
    ↓
Sport auto-detected (thumbnail → Claude vision)
    ↓
Pose estimation (MediaPipe, device-side)
    ↓
Joint angles + injury-risk levels extracted (6 joints)
    ↓
PATCH analysis with measured data
    ↓
Claude generates sport-specific tips grounded in the measurements
    ↓
User reviews colour-coded skeleton overlay + expandable tip cards
    ↓
"Ask Coach" → contextual chat
    ↓
Progress tracked across sessions (streak, weekly goal, score trend)
```

## Users

**Primary:** Serious amateur athletes (runners, basketball players, lifters, swimmers) who train 3–5× per week and want objective feedback they can act on, not generic advice.

**Secondary:** Coaches who want an objective starting point for a session debrief.

## Key screens

| Screen | Purpose |
|--------|---------|
| Home feed | Recent analyses, streak, weekly goal progress |
| Upload / Analyse | Record or pick video, sport confirm, processing state |
| Skeleton overlay | Frozen frame with colour-coded joints, expandable tip cards, Ask Coach |
| Progress | Score trend over time, personal bests per joint, weekly counts |
| Coach chat | Contextual AI conversation anchored to a specific analysis |
| Profile | Sport, level, goals, injury concerns, weekly target |

## What we do NOT do (yet)

- Side-by-side comparison with a pro reference athlete
- Real-time overlay during recording
- Team / coach portal
- Video trimming or editing
- Subscription / paywall
