-- Pending student registration + admin notifications
ALTER TYPE "notification_type" ADD VALUE 'user_pending_activation';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ(6);

ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'inactive';
