// ── Separate-file tables (canonical, integer-based IDs) ─────────────────────
export * from "./users";
export * from "./analyses";
export * from "./chatMessages";
export * from "./completedDrills";
export * from "./profiles";

// ── Additional tables kept in this file ─────────────────────────────────────
import {
  pgTable,
  text,
  integer,
  serial,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { analysesTable } from "./analyses";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "pro",
  "elite",
]);

export const athleteLevelEnum = pgEnum("athlete_level", [
  "beginner",
  "intermediate",
  "advanced",
  "elite",
]);

export const tipCategoryEnum = pgEnum("tip_category", [
  "technique",
  "injury-risk",
  "mobility",
  "strength",
  "conditioning",
]);

export const tipSeverityEnum = pgEnum("tip_severity", [
  "info",
  "warning",
  "critical",
]);

// ─── Athlete Profiles (legacy — routes/profile.ts still references this) ────

export const athleteProfilesTable = pgTable("athlete_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull().default(""),
  sport: text("sport").notNull().default(""),
  level: athleteLevelEnum("level").notNull().default("beginner"),
  goals: jsonb("goals").$type<string[]>().notNull().default([]),
  injuryConcerns: jsonb("injury_concerns").$type<string[]>().notNull().default([]),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  weeklyProgress: integer("weekly_progress").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAthleteProfileSchema = createInsertSchema(athleteProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAthleteProfile = z.infer<typeof insertAthleteProfileSchema>;
export type AthleteProfile = typeof athleteProfilesTable.$inferSelect;

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  tier: subscriptionTierEnum("tier").notNull().default("free"),
  status: text("status").notNull().default("active"),
  revenueCatCustomerId: text("revenue_cat_customer_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

// ─── Coaching Tips ───────────────────────────────────────────────────────────

export const coachingTipsTable = pgTable("coaching_tips", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => analysesTable.id, { onDelete: "cascade" }),
  category: tipCategoryEnum("category").notNull(),
  severity: tipSeverityEnum("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  drill: text("drill"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCoachingTipSchema = createInsertSchema(coachingTipsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCoachingTip = z.infer<typeof insertCoachingTipSchema>;
export type CoachingTip = typeof coachingTipsTable.$inferSelect;

// ─── Injury Risks ────────────────────────────────────────────────────────────

export const injuryRisksTable = pgTable("injury_risks", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id")
    .notNull()
    .references(() => analysesTable.id, { onDelete: "cascade" }),
  joint: text("joint").notNull(),
  riskPercent: real("risk_percent").notNull(),
  description: text("description").notNull(),
  prevention: text("prevention").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInjuryRiskSchema = createInsertSchema(injuryRisksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertInjuryRisk = z.infer<typeof insertInjuryRiskSchema>;
export type InjuryRisk = typeof injuryRisksTable.$inferSelect;

// ─── Progress Entries ────────────────────────────────────────────────────────

export const progressEntriesTable = pgTable("progress_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  overallScore: real("overall_score").notNull(),
  techniqueScore: real("technique_score"),
  powerScore: real("power_score"),
  balanceScore: real("balance_score"),
  consistencyScore: real("consistency_score"),
  mobilityScore: real("mobility_score"),
  speedScore: real("speed_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("progress_entries_user_id_idx").on(t.userId),
]);

export const insertProgressEntrySchema = createInsertSchema(progressEntriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProgressEntry = z.infer<typeof insertProgressEntrySchema>;
export type ProgressEntry = typeof progressEntriesTable.$inferSelect;

// ─── Achievements (catalog) ──────────────────────────────────────────────────

export const achievementsTable = pgTable("achievements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  requiredCount: integer("required_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Achievement = typeof achievementsTable.$inferSelect;

// ─── User Achievements ───────────────────────────────────────────────────────

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id")
    .notNull()
    .references(() => achievementsTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  total: integer("total").notNull().default(1),
  unlockedAt: timestamp("unlocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserAchievement = typeof userAchievementsTable.$inferSelect;
