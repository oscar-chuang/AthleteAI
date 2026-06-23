import { pgTable, serial, integer, text, timestamp, real, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sport: text("sport").notNull(),
  status: text("status").notNull().default("complete"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  overallScore: real("overall_score"),
  techniqueScore: real("technique_score"),
  powerScore: real("power_score"),
  balanceScore: real("balance_score"),
  consistencyScore: real("consistency_score"),
  mobilityScore: real("mobility_score"),
  speedScore: real("speed_score"),
  strengths: text("strengths").array().notNull().default([]),
  improvements: text("improvements").array().notNull().default([]),
  tips: jsonb("tips").$type<object[]>().default([]),
  injuryRisks: jsonb("injury_risks").$type<object[]>().default([]),
  jointAngles: jsonb("joint_angles").$type<Record<string, number>>(),
  jointRisks: jsonb("joint_risks").$type<Record<string, number>>(),
  biomechanicsApplied: boolean("biomechanics_applied").notNull().default(false),
  coachingMoments: jsonb("coaching_moments").$type<object[]>(),
  movementSummary: jsonb("movement_summary").$type<object>(),
  movementSummaryAt: timestamp("movement_summary_at"),
  movementType: text("movement_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (t) => [
  index("analyses_user_id_idx").on(t.userId),
  index("analyses_uploaded_at_idx").on(t.uploadedAt),
  index("analyses_user_id_uploaded_at_idx").on(t.userId, t.uploadedAt),
  index("analyses_user_id_status_biom_idx").on(t.userId, t.status, t.biomechanicsApplied),
]);

export type Analysis = typeof analysesTable.$inferSelect;
export type InsertAnalysis = typeof analysesTable.$inferInsert;
