-- Additive indexes for institutional training list/comparison queries.
-- Safe to apply with prisma migrate deploy. Does not rewrite or drop data.

CREATE INDEX IF NOT EXISTS "idx_training_enrollments_cohort_status"
  ON "training_enrollments" ("cohort_id", "status");

CREATE INDEX IF NOT EXISTS "idx_training_assessment_attempts_enrollment"
  ON "training_assessment_attempts" ("enrollment_id");

CREATE INDEX IF NOT EXISTS "idx_training_assessment_attempts_assessment_status"
  ON "training_assessment_attempts" ("assessment_id", "status");
