-- ACADEMIC-SUBMISSION-001: one academic submission per student per assessment.
-- Additive and reversible. Safe when no duplicate (assessment_id, student_id) groups exist.
-- Does not modify or delete existing rows.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_submissions_assessment_student"
  ON "submissions" ("assessment_id", "student_id");
