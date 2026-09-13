-- Additive nullable close deadline for Field Training PRE/POST assessments.
-- Existing rows stay NULL and keep legacy open behavior (not retroactively closed).
ALTER TABLE "field_training_assessments"
  ADD COLUMN IF NOT EXISTS "closes_at" TIMESTAMPTZ(6);
