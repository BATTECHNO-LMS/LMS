-- Assessments (cohort + micro-credential scoped)
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "micro_credential_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "assessment_type" "assessment_type" NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "open_at" TIMESTAMPTZ(6),
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "linked_outcome_id" UUID,
    "rubric_id" UUID,
    "instructions" TEXT,
    "status" "assessment_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_assessments_cohort_id" ON "assessments"("cohort_id");
CREATE INDEX IF NOT EXISTS "idx_assessments_micro_credential_id" ON "assessments"("micro_credential_id");
CREATE INDEX IF NOT EXISTS "idx_assessments_linked_outcome_id" ON "assessments"("linked_outcome_id");
CREATE INDEX IF NOT EXISTS "idx_assessments_rubric_id" ON "assessments"("rubric_id");
CREATE INDEX IF NOT EXISTS "idx_assessments_status" ON "assessments"("status");

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_micro_credential_id_fkey"
  FOREIGN KEY ("micro_credential_id") REFERENCES "micro_credentials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_linked_outcome_id_fkey"
  FOREIGN KEY ("linked_outcome_id") REFERENCES "learning_outcomes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "assessments"
  ADD CONSTRAINT "assessments_rubric_id_fkey"
  FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Link submissions and grades to assessments (fails if orphaned rows exist; clean data first if needed).
ALTER TABLE "submissions"
  DROP CONSTRAINT IF EXISTS "submissions_assessment_id_fkey";

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "grades"
  DROP CONSTRAINT IF EXISTS "grades_assessment_id_fkey";

ALTER TABLE "grades"
  ADD CONSTRAINT "grades_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
