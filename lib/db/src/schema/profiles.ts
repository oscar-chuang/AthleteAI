import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  sport: text("sport").notNull().default(""),
  level: text("level").notNull().default("beginner"),
  goals: text("goals").array().notNull().default([]),
  injuryConcerns: text("injury_concerns").array().notNull().default([]),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  trainingDays: integer("training_days").array().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
