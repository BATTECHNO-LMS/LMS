-- Field Training end-to-end workflow — Phase 1 data model
-- Attendance rule: required sessions only; present + late + excused = attended; absent = not attended.

-- CreateEnum
CREATE TYPE "field_training_training_status" AS ENUM (
  'none',
  'pre_assessment_pending',
  'pre_assessment_completed',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
  'failed',
  'expelled'
);

CREATE TYPE "field_training_knowledge_level" AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TYPE "field_training_final_task_status" AS ENUM (
  'not_required',
  'pending',
  'submitted',
  'approved',
  'rejected'
);

CREATE TYPE "field_training_completion_eligibility_status" AS ENUM ('pending', 'eligible', 'ineligible');

CREATE TYPE "field_training_attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TYPE "field_training_assessment_type" AS ENUM ('pre', 'post');

CREATE TYPE "field_training_assessment_status" AS ENUM ('draft', 'published', 'closed');

CREATE TYPE "field_training_question_type" AS ENUM ('multiple_choice', 'true_false', 'short_answer');

CREATE TYPE "field_training_task_review_status" AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');

CREATE TYPE "field_training_completion_letter_status" AS ENUM ('issued', 'revoked');

-- Extend opportunities
ALTER TABLE "field_training_opportunities"
  ADD COLUMN "assigned_instructor_id" UUID,
  ADD COLUMN "requires_pre_assessment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requires_post_assessment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requires_final_task" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "minimum_attendance_percentage" INTEGER,
  ADD COLUMN "minimum_post_assessment_score" DECIMAL(5,2),
  ADD COLUMN "completion_rules" JSONB;

CREATE INDEX "idx_field_training_opportunities_instructor"
  ON "field_training_opportunities"("assigned_instructor_id");

-- Extend applications (participant lifecycle)
ALTER TABLE "field_training_applications"
  ADD COLUMN "training_status" "field_training_training_status" NOT NULL DEFAULT 'none',
  ADD COLUMN "training_started_at" TIMESTAMPTZ(6),
  ADD COLUMN "pre_assessment_score" DECIMAL(6,2),
  ADD COLUMN "pre_assessment_level" "field_training_knowledge_level",
  ADD COLUMN "post_assessment_score" DECIMAL(6,2),
  ADD COLUMN "attendance_percentage" DECIMAL(5,2),
  ADD COLUMN "final_task_status" "field_training_final_task_status" NOT NULL DEFAULT 'not_required',
  ADD COLUMN "completion_eligibility_status" "field_training_completion_eligibility_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN "expelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "expelled_by_id" UUID,
  ADD COLUMN "expulsion_reason" TEXT,
  ADD COLUMN "completion_letter_issued_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_field_training_applications_training_status"
  ON "field_training_applications"("training_status");

-- Backfill: approved applications enter workflow at first gate
UPDATE "field_training_applications" AS a
SET
  "training_status" = CASE
    WHEN o."requires_pre_assessment" THEN 'pre_assessment_pending'::"field_training_training_status"
    ELSE 'in_training'::"field_training_training_status"
  END,
  "final_task_status" = CASE
    WHEN o."requires_final_task" THEN 'pending'::"field_training_final_task_status"
    ELSE 'not_required'::"field_training_final_task_status"
  END
FROM "field_training_opportunities" AS o
WHERE a."opportunity_id" = o."id"
  AND a."status" = 'approved';

-- Extend tasks
ALTER TABLE "field_training_tasks"
  ADD COLUMN "ai_self_evaluation_prompt" TEXT,
  ADD COLUMN "requires_ai_self_evaluation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_final_task" BOOLEAN NOT NULL DEFAULT false;

-- Extend task submissions
ALTER TABLE "field_training_task_submissions"
  ADD COLUMN "student_self_evaluation_input" TEXT,
  ADD COLUMN "ai_prompt_used" TEXT,
  ADD COLUMN "ai_model_provider" VARCHAR(80),
  ADD COLUMN "ai_model_name" VARCHAR(120),
  ADD COLUMN "ai_raw_response" TEXT,
  ADD COLUMN "ai_response_inserted_text" TEXT,
  ADD COLUMN "final_student_notes" TEXT,
  ADD COLUMN "is_late" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "review_status" "field_training_task_review_status" NOT NULL DEFAULT 'pending',
  ADD COLUMN "instructor_feedback" TEXT,
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_field_training_task_submissions_review_status"
  ON "field_training_task_submissions"("review_status");

-- Sessions
CREATE TABLE "field_training_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "session_date" DATE NOT NULL,
  "start_time" VARCHAR(8) NOT NULL,
  "end_time" VARCHAR(8) NOT NULL,
  "zoom_link" VARCHAR(2000),
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_field_training_sessions_opportunity" ON "field_training_sessions"("opportunity_id");
CREATE INDEX "idx_field_training_sessions_date" ON "field_training_sessions"("session_date");

ALTER TABLE "field_training_sessions"
  ADD CONSTRAINT "field_training_sessions_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Attendance
CREATE TABLE "field_training_attendance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "status" "field_training_attendance_status" NOT NULL,
  "note" TEXT,
  "recorded_by_id" UUID,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_field_training_attendance_session_application"
  ON "field_training_attendance"("session_id", "application_id");
CREATE INDEX "idx_field_training_attendance_student" ON "field_training_attendance"("student_id");
CREATE INDEX "idx_field_training_attendance_application" ON "field_training_attendance"("application_id");

ALTER TABLE "field_training_attendance"
  ADD CONSTRAINT "field_training_attendance_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "field_training_sessions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_attendance"
  ADD CONSTRAINT "field_training_attendance_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Assessments
CREATE TABLE "field_training_assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL,
  "type" "field_training_assessment_type" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "passing_score" DECIMAL(5,2),
  "status" "field_training_assessment_status" NOT NULL DEFAULT 'draft',
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_field_training_assessments_opportunity_type"
  ON "field_training_assessments"("opportunity_id", "type");
CREATE INDEX "idx_field_training_assessments_opportunity" ON "field_training_assessments"("opportunity_id");
CREATE INDEX "idx_field_training_assessments_status" ON "field_training_assessments"("status");

ALTER TABLE "field_training_assessments"
  ADD CONSTRAINT "field_training_assessments_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "field_training_assessment_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL,
  "question_text" TEXT NOT NULL,
  "question_type" "field_training_question_type" NOT NULL,
  "options" JSONB,
  "correct_answer" JSONB,
  "points" DECIMAL(6,2) NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_assessment_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_field_training_assessment_questions_assessment"
  ON "field_training_assessment_questions"("assessment_id");

ALTER TABLE "field_training_assessment_questions"
  ADD CONSTRAINT "field_training_assessment_questions_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "field_training_assessments"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "field_training_assessment_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "answers" JSONB,
  "score" DECIMAL(6,2),
  "max_score" DECIMAL(6,2),
  "level" "field_training_knowledge_level",
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_assessment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_field_training_assessment_attempts"
  ON "field_training_assessment_attempts"("assessment_id", "application_id");
CREATE INDEX "idx_field_training_assessment_attempts_student"
  ON "field_training_assessment_attempts"("student_id");

ALTER TABLE "field_training_assessment_attempts"
  ADD CONSTRAINT "field_training_assessment_attempts_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "field_training_assessments"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_assessment_attempts"
  ADD CONSTRAINT "field_training_assessment_attempts_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Completion letters
CREATE TABLE "field_training_completion_letters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "letter_no" VARCHAR(80) NOT NULL,
  "status" "field_training_completion_letter_status" NOT NULL DEFAULT 'issued',
  "issued_by_id" UUID,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdf_url" TEXT,
  "verification_code" VARCHAR(64),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_training_completion_letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_training_completion_letters_letter_no_key"
  ON "field_training_completion_letters"("letter_no");
CREATE UNIQUE INDEX "field_training_completion_letters_verification_code_key"
  ON "field_training_completion_letters"("verification_code");
CREATE INDEX "idx_field_training_completion_letters_student"
  ON "field_training_completion_letters"("student_id");
CREATE INDEX "idx_field_training_completion_letters_opportunity"
  ON "field_training_completion_letters"("opportunity_id");
CREATE INDEX "idx_field_training_completion_letters_status"
  ON "field_training_completion_letters"("status");

ALTER TABLE "field_training_completion_letters"
  ADD CONSTRAINT "field_training_completion_letters_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "field_training_completion_letters"
  ADD CONSTRAINT "field_training_completion_letters_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
