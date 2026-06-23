import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  referencedAnalysisId: integer("referenced_analysis_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("chat_messages_user_id_idx").on(t.userId),
  index("chat_messages_created_at_idx").on(t.createdAt),
  index("chat_messages_user_id_created_at_idx").on(t.userId, t.createdAt),
]);

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;
