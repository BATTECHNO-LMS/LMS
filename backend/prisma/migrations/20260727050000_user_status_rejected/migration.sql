-- Rejected account status + optional public reason shown to the student.

ALTER TYPE "user_status" ADD VALUE 'rejected';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status_public_message" VARCHAR(500);
