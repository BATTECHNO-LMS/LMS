-- Field Training workflow Phase 2 — status extensions

ALTER TYPE "field_training_opportunity_status" ADD VALUE IF NOT EXISTS 'in_progress';

ALTER TYPE "field_training_training_status" ADD VALUE IF NOT EXISTS 'ready_for_training';

ALTER TYPE "field_training_completion_eligibility_status" ADD VALUE IF NOT EXISTS 'needs_review';

ALTER TABLE "field_training_opportunities"
  ADD COLUMN IF NOT EXISTS "training_started_at" TIMESTAMPTZ(6);

ALTER TABLE "field_training_applications"
  ADD COLUMN IF NOT EXISTS "eligibility_reason" JSONB;
