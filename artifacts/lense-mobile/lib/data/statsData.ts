import type { AthleteProfile, ChatMessage } from "../types";
import { MOCK_ANALYSES } from "./drillsData";
import { MOCK_PROGRESS } from "./progressData";
import { MOCK_ACHIEVEMENTS } from "./achievementsData";

export { MOCK_ANALYSES, MOCK_PROGRESS, MOCK_ACHIEVEMENTS };

export const MOCK_ATHLETE: AthleteProfile = {
  id: "athlete-001",
  name: "Alex Rivera",
  email: "alex@example.com",
  sport: "weightlifting",
  level: "advanced",
  tier: "pro",
  joinedAt: "2026-01-10",
  analyses: MOCK_ANALYSES,
  progressHistory: MOCK_PROGRESS,
  achievements: MOCK_ACHIEVEMENTS,
  weeklyGoal: 4,
  weeklyProgress: 3,
  streakDays: 14,
};

export const MOCK_CHAT: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content: "Hey Alex! I've reviewed your last 4 analyses. Your power output has improved significantly (+18% over 5 months) — great work on that. Your biggest opportunity right now is technique refinement, particularly your hip mechanics in the deadlift. Want me to walk you through a specific drill protocol?",
    timestamp: "2026-06-01T09:00:00Z",
  },
  {
    id: "msg-2",
    role: "user",
    content: "Yeah, my lower back has been feeling tight after heavy sessions. Is my form causing that?",
    timestamp: "2026-06-01T09:01:00Z",
  },
  {
    id: "msg-3",
    role: "assistant",
    content: "Most likely yes. Looking at your deadlift analysis (an-001), I detected 18° of lumbar flexion under load — anything over 10° consistently creates disc compression stress over time.\n\nHere's what I recommend:\n\nImmediate (this week):\n• Drop load by 10-15% and focus on bracing protocol\n• Spend 10 min on McGill Big 3 before every session\n\nNext 2-4 weeks:\n• Romanian deadlifts 3×8 at 60% of your 1RM\n• Hip hinge with dowel on spine\n\nUpload a new video in 3 weeks. I'll compare the lumbar angle directly against today's baseline.",
    timestamp: "2026-06-01T09:01:30Z",
    referencedAnalysis: "an-001",
  },
];
