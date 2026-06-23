import { profilesTable } from "@workspace/db";

export function formatProfile(
  p: typeof profilesTable.$inferSelect,
  streakDays = 0,
  weeklyProgress = 0,
) {
  return {
    id: String(p.id),
    userId: String(p.userId),
    name: p.name,
    sport: p.sport,
    level: p.level as "beginner" | "intermediate" | "advanced" | "elite",
    goals: p.goals ?? [],
    injuryConcerns: p.injuryConcerns ?? [],
    weeklyGoal: p.weeklyGoal,
    trainingDays: p.trainingDays ?? [0, 1, 2, 3, 4, 5, 6],
    checkInHour: p.checkInHour ?? 9,
    weeklyProgress,
    streakDays,
    avatarUrl: p.avatarUrl ?? null,
    weeklyGoalCelebratedAt: p.weeklyGoalCelebratedAt ?? null,
  };
}
