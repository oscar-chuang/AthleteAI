import { pgTable, serial, integer, text, timestamp, real, jsonb } from "drizzle-orm/pg-core";
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
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export type Analysis = typeof analysesTable.$inferSelect;
export type InsertAnalysis = typeof analysesTable.$inferInsert;
