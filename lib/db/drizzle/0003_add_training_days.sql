ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "training_days" integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
