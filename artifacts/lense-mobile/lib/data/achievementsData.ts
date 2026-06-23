import type { Achievement } from "../types";

export const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: "ach-1", title: "First Analysis", description: "Upload and analyze your first video", icon: "🎬", unlockedAt: "2026-01-15", progress: 1, total: 1 },
  { id: "ach-2", title: "Consistency King", description: "Maintain a 7-day training streak", icon: "🔥", unlockedAt: "2026-02-10", progress: 7, total: 7 },
  { id: "ach-3", title: "Power House", description: "Score 90+ on Power", icon: "⚡", unlockedAt: "2026-05-28", progress: 91, total: 90 },
  { id: "ach-4", title: "10 Analyses", description: "Complete 10 video analyses", icon: "📊", unlockedAt: "2026-04-20", progress: 10, total: 10 },
  { id: "ach-5", title: "Technique Master", description: "Score 80+ on Technique", icon: "🎯", unlockedAt: null, progress: 79, total: 80 },
  { id: "ach-6", title: "30-Day Streak", description: "Train 30 consecutive days", icon: "🏆", unlockedAt: null, progress: 14, total: 30 },
  { id: "ach-7", title: "Pro Comparison", description: "Complete your first pro athlete comparison", icon: "🌟", unlockedAt: "2026-05-20", progress: 1, total: 1 },
  { id: "ach-8", title: "Multi-Sport", description: "Analyze 3 different sports", icon: "🏅", unlockedAt: "2026-04-15", progress: 3, total: 3 },
];
