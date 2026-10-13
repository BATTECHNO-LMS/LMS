-- Additive only: server-side auth sessions + audit context columns.
-- No DROP / TRUNCATE / data rewrite. Legacy audit rows keep NULLs in the new columns.

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "end_reason" VARCHAR(32),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_by_login_method" VARCHAR(32) NOT NULL DEFAULT 'PASSWORD',
    "portal_type" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user_active" ON "auth_sessions"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_last_activity" ON "auth_sessions"("last_activity_at");
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_absolute_expires" ON "auth_sessions"("absolute_expires_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_user_id_fkey') THEN
    ALTER TABLE "auth_sessions"
      ADD CONSTRAINT "auth_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AlterTable (additive columns)
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "subject_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "session_id" UUID,
  ADD COLUMN IF NOT EXISTS "request_id" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "outcome" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "actor_role" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(512);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_subject_created" ON "audit_logs"("subject_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_session_created" ON "audit_logs"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_category_created" ON "audit_logs"("category", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action_created" ON "audit_logs"("action_type", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_created" ON "audit_logs"("user_id", "created_at");
