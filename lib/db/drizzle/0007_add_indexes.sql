-- Composite indexes for the most common query patterns
-- analyses: list by user ordered by date (GET /analyses, GET /progress)
CREATE INDEX IF NOT EXISTS "analyses_user_id_uploaded_at_idx" ON "analyses" ("user_id", "uploaded_at");

-- analyses: poll for user + status + biomechanics_applied (AI re-analysis guard)
CREATE INDEX IF NOT EXISTS "analyses_user_id_status_biom_idx" ON "analyses" ("user_id", "status", "biomechanics_applied");

-- chat_messages: fetch conversation history by user ordered by date
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_created_at_idx" ON "chat_messages" ("user_id", "created_at");

-- completed_drills: look up drills by user and by analysis
CREATE INDEX IF NOT EXISTS "completed_drills_user_id_idx" ON "completed_drills" ("user_id");
CREATE INDEX IF NOT EXISTS "completed_drills_analysis_id_idx" ON "completed_drills" ("analysis_id");
