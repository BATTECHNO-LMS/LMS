-- Additive only: scheduled jobs table (other notification engine tables already exist)

CREATE TABLE IF NOT EXISTS "notification_scheduled_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "job_key" VARCHAR(200) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(80),
  "entity_id" UUID,
  "run_at" TIMESTAMPTZ(6) NOT NULL,
  "payload_json" JSONB,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_scheduled_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_scheduled_jobs_job_key_key" ON "notification_scheduled_jobs"("job_key");
CREATE INDEX IF NOT EXISTS "idx_notification_scheduled_jobs_run" ON "notification_scheduled_jobs"("run_at", "status");
CREATE INDEX IF NOT EXISTS "idx_notification_scheduled_jobs_event" ON "notification_scheduled_jobs"("event_type");

-- Ensure extended notification columns exist (idempotent)
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "action_label" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "entity_type" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "entity_id" UUID,
  ADD COLUMN IF NOT EXISTS "rule_id" UUID,
  ADD COLUMN IF NOT EXISTS "template_id" UUID,
  ADD COLUMN IF NOT EXISTS "actor_id" UUID,
  ADD COLUMN IF NOT EXISTS "is_critical" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "deduplication_key" VARCHAR(300);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_notifications_deduplication_key" ON "notifications"("deduplication_key");
