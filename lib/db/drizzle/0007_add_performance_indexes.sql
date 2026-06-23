CREATE INDEX IF NOT EXISTS "analyses_user_id_idx" ON "analyses" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analyses_uploaded_at_idx" ON "analyses" ("uploaded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_idx" ON "chat_messages" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_created_at_idx" ON "chat_messages" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "completed_drills_user_id_idx" ON "completed_drills" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "completed_drills_analysis_id_idx" ON "completed_drills" ("analysis_id");
