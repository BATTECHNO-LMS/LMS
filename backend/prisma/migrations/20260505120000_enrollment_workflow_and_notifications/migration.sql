-- Enrollments: approval workflow
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "approved_by" UUID;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6);
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

-- Notifications: deep links
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action_url" VARCHAR(2000);

-- notification_type enum additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'student_enrollment_requested'
  ) THEN
    ALTER TYPE "notification_type" ADD VALUE 'student_enrollment_requested';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'enrollment_approved'
  ) THEN
    ALTER TYPE "notification_type" ADD VALUE 'enrollment_approved';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'enrollment_rejected'
  ) THEN
    ALTER TYPE "notification_type" ADD VALUE 'enrollment_rejected';
  END IF;
END $$;
