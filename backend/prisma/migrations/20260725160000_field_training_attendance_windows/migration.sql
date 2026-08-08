-- Field training electronic attendance windows

DO $$ BEGIN
  ALTER TYPE "field_training_attendance_status" ADD VALUE IF NOT EXISTS 'unconfirmed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "field_training_attendance_window_status" AS ENUM ('pending', 'open', 'closed', 'finalized');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "field_training_attendance_window_mode" AS ENUM ('normal', 'late');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "field_training_attendance_method" AS ENUM ('electronic', 'manual', 'auto_finalize');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "field_training_attendance_windows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "status" "field_training_attendance_window_status" NOT NULL DEFAULT 'pending',
  "mode" "field_training_attendance_window_mode" NOT NULL DEFAULT 'normal',
  "opened_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "opened_by_id" UUID,
  "closed_by_id" UUID,
  "duration_seconds" INTEGER NOT NULL DEFAULT 120,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_ft_attendance_windows_session"
    FOREIGN KEY ("session_id") REFERENCES "field_training_sessions"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ft_attendance_window_open_session"
  ON "field_training_attendance_windows" ("session_id")
  WHERE "status" = 'open';

CREATE INDEX IF NOT EXISTS "idx_ft_attendance_windows_session"
  ON "field_training_attendance_windows" ("session_id");

CREATE INDEX IF NOT EXISTS "idx_ft_attendance_windows_status_expires"
  ON "field_training_attendance_windows" ("status", "expires_at");

CREATE TABLE IF NOT EXISTS "field_training_attendance_window_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "window_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_ft_attendance_window_attempts_window"
    FOREIGN KEY ("window_id") REFERENCES "field_training_attendance_windows"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "uq_ft_attendance_window_attempts_student"
    UNIQUE ("window_id", "student_id")
);

ALTER TABLE "field_training_attendance"
  ADD COLUMN IF NOT EXISTS "method" "field_training_attendance_method",
  ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "manual_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "attendance_window_id" UUID,
  ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "device_info" VARCHAR(500);

DO $$ BEGIN
  ALTER TABLE "field_training_attendance"
    ADD CONSTRAINT "fk_ft_attendance_window"
    FOREIGN KEY ("attendance_window_id") REFERENCES "field_training_attendance_windows"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill existing rows as manual attendance without changing status
UPDATE "field_training_attendance"
SET "method" = 'manual'::"field_training_attendance_method"
WHERE "method" IS NULL;
