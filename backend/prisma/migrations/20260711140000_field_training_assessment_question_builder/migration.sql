-- Extend field training assessment question types and grading metadata.

DO $$ BEGIN
  ALTER TYPE "field_training_question_type" ADD VALUE 'short_text';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "field_training_question_type" ADD VALUE 'long_text';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "field_training_question_type" ADD VALUE 'multi_select';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "field_training_assessment_questions"
  ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "field_training_assessment_attempts"
  ADD COLUMN IF NOT EXISTS "grading_details" JSONB;
