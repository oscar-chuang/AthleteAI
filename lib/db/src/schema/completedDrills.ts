import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { analysesTable } from "./analyses";

export const completedDrillsTable = pgTable("completed_drills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  analysisId: integer("analysis_id").notNull().references(() => analysesTable.id, { onDelete: "cascade" }),
  tipId: text("tip_id").notNull(),
  drillName: text("drill_name"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export type CompletedDrill = typeof completedDrillsTable.$inferSelect;
export type InsertCompletedDrill = typeof completedDrillsTable.$inferInsert;
