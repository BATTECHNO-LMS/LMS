-- Institutional portal foundation (additive, non-destructive)

CREATE TYPE "organization_type" AS ENUM ('UNIVERSITY', 'INSTITUTION');
CREATE TYPE "organization_status" AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE "institution_kind" AS ENUM ('government', 'private', 'association', 'organization', 'training_center', 'international', 'other');
CREATE TYPE "email_verification_method" AS ENUM ('OTP', 'ADMIN', 'IMPORT');
CREATE TYPE "training_program_type" AS ENUM ('FIELD_TRAINING', 'TRAINING_COURSE');
CREATE TYPE "training_program_status" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "training_cohort_status" AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "training_enrollment_status" AS ENUM ('INVITED', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_UPDATE', 'ACTIVE', 'WITHDRAWN', 'REQUIREMENTS_COMPLETED', 'COMPLETED', 'NOT_COMPLETED');
CREATE TYPE "training_session_status" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "training_assessment_kind" AS ENUM ('PRE_TEST', 'POST_TEST');
CREATE TYPE "training_assessment_attempt_status" AS ENUM ('NOT_AVAILABLE', 'AVAILABLE', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED');
CREATE TYPE "training_certificate_status" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'PENDING_ISSUANCE', 'ISSUED', 'REVOKED');
CREATE TYPE "training_progress_status" AS ENUM ('COMPLETED', 'INCOMPLETE', 'PENDING_REVIEW', 'NOT_REQUIRED', 'NOT_AVAILABLE');
CREATE TYPE "kpi_alert_status" AS ENUM ('ON_TARGET', 'AT_RISK', 'OFF_TARGET');

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_audit_logs_organization_id" ON "audit_logs"("organization_id");

ALTER TABLE "universities" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_universities_organization_id" ON "universities"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_universities_organization_id" ON "universities"("organization_id");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_method" "email_verification_method";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activated_by" UUID;

ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_support_tickets_org" ON "support_tickets"("organization_id");

ALTER TABLE "announcement_targets" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_announcement_targets_organization" ON "announcement_targets"("organization_id");

CREATE TABLE IF NOT EXISTS "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "organization_type" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "short_name" VARCHAR(80),
    "code" VARCHAR(50),
    "institution_kind" "institution_kind",
    "website" VARCHAR(500),
    "country" VARCHAR(120),
    "city" VARCHAR(120),
    "address" VARCHAR(500),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "logo_url" VARCHAR(1000),
    "status" "organization_status" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_organizations_code" ON "organizations"("code");
CREATE INDEX IF NOT EXISTS "idx_organizations_type" ON "organizations"("type");
CREATE INDEX IF NOT EXISTS "idx_organizations_status" ON "organizations"("status");
CREATE INDEX IF NOT EXISTS "idx_organizations_name" ON "organizations"("name");

CREATE TABLE IF NOT EXISTS "organization_email_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_email_domains_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_email_domains_org_domain" ON "organization_email_domains"("organization_id", "domain");
CREATE INDEX IF NOT EXISTS "idx_organization_email_domains_org" ON "organization_email_domains"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_email_domains_domain" ON "organization_email_domains"("domain");

CREATE TABLE IF NOT EXISTS "organization_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(80),
    "city" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_branches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_organization_branches_org" ON "organization_branches"("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_branches_org_code" ON "organization_branches"("organization_id", "code");

CREATE TABLE IF NOT EXISTS "organization_departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(80),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_departments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_organization_departments_org" ON "organization_departments"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_departments_branch" ON "organization_departments"("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_departments_org_code" ON "organization_departments"("organization_id", "code");

CREATE TABLE IF NOT EXISTS "user_organization_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_code" VARCHAR(50) NOT NULL,
    "branch_id" UUID,
    "department_id" UUID,
    "job_title" VARCHAR(255),
    "employee_number" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_organization_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_user_org_assignments_user" ON "user_organization_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_org_assignments_org" ON "user_organization_assignments"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_user_org_assignments_org_role_active" ON "user_organization_assignments"("organization_id", "role_code", "is_active");
CREATE INDEX IF NOT EXISTS "idx_user_org_assignments_user_active" ON "user_organization_assignments"("user_id", "is_active");

CREATE TABLE IF NOT EXISTS "training_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "type" "training_program_type" NOT NULL DEFAULT 'TRAINING_COURSE',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "field" VARCHAR(255),
    "objectives" TEXT,
    "outcomes" TEXT,
    "level" VARCHAR(80),
    "language" VARCHAR(40),
    "delivery_mode" VARCHAR(40),
    "required_hours" DECIMAL(8,2),
    "required_attendance_pct" DECIMAL(5,2),
    "max_participants" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "status" "training_program_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_programs_org" ON "training_programs"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_programs_status" ON "training_programs"("status");
CREATE INDEX IF NOT EXISTS "idx_training_programs_type" ON "training_programs"("type");

CREATE TABLE IF NOT EXISTS "training_cohorts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "branch_id" UUID,
    "department_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "capacity" INTEGER,
    "status" "training_cohort_status" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_cohorts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_cohorts_program" ON "training_cohorts"("program_id");
CREATE INDEX IF NOT EXISTS "idx_training_cohorts_org" ON "training_cohorts"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_cohorts_status" ON "training_cohorts"("status");

CREATE TABLE IF NOT EXISTS "training_cohort_instructors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_cohort_instructors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_cohort_instructors" ON "training_cohort_instructors"("cohort_id", "instructor_id");
CREATE INDEX IF NOT EXISTS "idx_training_cohort_instructors_user" ON "training_cohort_instructors"("instructor_id");

CREATE TABLE IF NOT EXISTS "training_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "training_enrollment_status" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "invited_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_enrollments_cohort_user" ON "training_enrollments"("cohort_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_training_enrollments_org" ON "training_enrollments"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_enrollments_user" ON "training_enrollments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_training_enrollments_status" ON "training_enrollments"("status");

CREATE TABLE IF NOT EXISTS "training_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "instructor_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "hours" DECIMAL(6,2),
    "session_type" VARCHAR(40),
    "meeting_url" VARCHAR(1000),
    "location" VARCHAR(500),
    "attendance_required" BOOLEAN NOT NULL DEFAULT true,
    "counts_toward_hours" BOOLEAN NOT NULL DEFAULT true,
    "status" "training_session_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_sessions_cohort" ON "training_sessions"("cohort_id");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_starts" ON "training_sessions"("starts_at");

CREATE TABLE IF NOT EXISTS "training_attendance_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "opens_at" TIMESTAMPTZ(6) NOT NULL,
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "late_closes_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER NOT NULL DEFAULT 120,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_attendance_windows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_attendance_windows_session" ON "training_attendance_windows"("session_id");

CREATE TABLE IF NOT EXISTS "training_attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "window_id" UUID,
    "status" "attendance_status" NOT NULL DEFAULT 'absent',
    "marked_via" VARCHAR(40),
    "marked_by" UUID,
    "reason" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_attendance_session_enrollment" ON "training_attendance_records"("session_id", "enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_training_attendance_user" ON "training_attendance_records"("user_id");

CREATE TABLE IF NOT EXISTS "training_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "cohort_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "instructions" TEXT,
    "max_score" DECIMAL(8,2),
    "grading_mode" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "is_final_task" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "allow_resubmit" BOOLEAN NOT NULL DEFAULT true,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "published_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_tasks_program" ON "training_tasks"("program_id");
CREATE INDEX IF NOT EXISTS "idx_training_tasks_cohort" ON "training_tasks"("cohort_id");

CREATE TABLE IF NOT EXISTS "training_task_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
    "content_text" TEXT,
    "content_url" VARCHAR(1000),
    "score" DECIMAL(8,2),
    "feedback" TEXT,
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_task_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_task_submissions_task" ON "training_task_submissions"("task_id");
CREATE INDEX IF NOT EXISTS "idx_training_task_submissions_enrollment" ON "training_task_submissions"("enrollment_id");
CREATE INDEX IF NOT EXISTS "idx_training_task_submissions_user" ON "training_task_submissions"("user_id");

CREATE TABLE IF NOT EXISTS "training_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "kind" "training_assessment_kind" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "instructions" TEXT,
    "duration_minutes" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "pass_score" DECIMAL(8,2),
    "opens_at" TIMESTAMPTZ(6),
    "closes_at" TIMESTAMPTZ(6),
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "show_results" BOOLEAN NOT NULL DEFAULT true,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_assessments_program_kind" ON "training_assessments"("program_id", "kind");
CREATE INDEX IF NOT EXISTS "idx_training_assessments_program" ON "training_assessments"("program_id");

CREATE TABLE IF NOT EXISTS "training_assessment_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "question_type" VARCHAR(40) NOT NULL DEFAULT 'single_choice',
    "options_json" JSONB,
    "correct_answer" JSONB,
    "points" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_assessment_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_training_assessment_questions_assessment" ON "training_assessment_questions"("assessment_id");

CREATE TABLE IF NOT EXISTS "training_assessment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" "training_assessment_attempt_status" NOT NULL DEFAULT 'AVAILABLE',
    "answers_json" JSONB,
    "score" DECIMAL(8,2),
    "started_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "graded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_assessment_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_assessment_attempts" ON "training_assessment_attempts"("assessment_id", "enrollment_id", "attempt_no");
CREATE INDEX IF NOT EXISTS "idx_training_assessment_attempts_user" ON "training_assessment_attempts"("user_id");

CREATE TABLE IF NOT EXISTS "training_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "threshold_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_requirements_program_code" ON "training_requirements"("program_id", "code");

CREATE TABLE IF NOT EXISTS "training_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "completion_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hours_completed" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "hours_required" DECIMAL(8,2),
    "attendance_pct" DECIMAL(5,2),
    "status" "training_progress_status" NOT NULL DEFAULT 'INCOMPLETE',
    "requirements_json" JSONB,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_progress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "training_progress_enrollment_id_key" ON "training_progress"("enrollment_id");

CREATE TABLE IF NOT EXISTS "training_certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "certificate_number" VARCHAR(80) NOT NULL,
    "verification_code" VARCHAR(80) NOT NULL,
    "status" "training_certificate_status" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "issued_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "issued_by" UUID,
    "hours" DECIMAL(8,2),
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "training_certificates_certificate_number_key" ON "training_certificates"("certificate_number");
CREATE UNIQUE INDEX IF NOT EXISTS "training_certificates_verification_code_key" ON "training_certificates"("verification_code");
CREATE INDEX IF NOT EXISTS "idx_training_certificates_org" ON "training_certificates"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_training_certificates_status" ON "training_certificates"("status");

CREATE TABLE IF NOT EXISTS "kpi_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "category" VARCHAR(80) NOT NULL,
    "formula_key" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_definitions_code_key" ON "kpi_definitions"("code");

CREATE TABLE IF NOT EXISTS "kpi_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "organization_id" UUID,
    "program_id" UUID,
    "cohort_id" UUID,
    "target_value" DECIMAL(12,4) NOT NULL,
    "warn_value" DECIMAL(12,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_kpi_targets_kpi" ON "kpi_targets"("kpi_id");
CREATE INDEX IF NOT EXISTS "idx_kpi_targets_org" ON "kpi_targets"("organization_id");

CREATE TABLE IF NOT EXISTS "kpi_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "organization_id" UUID,
    "program_id" UUID,
    "cohort_id" UUID,
    "value" DECIMAL(12,4) NOT NULL,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,
    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_kpi_computed" ON "kpi_snapshots"("kpi_id", "computed_at");
CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_org" ON "kpi_snapshots"("organization_id");

CREATE TABLE IF NOT EXISTS "kpi_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_id" UUID NOT NULL,
    "organization_id" UUID,
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "status" "kpi_alert_status" NOT NULL,
    "message" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    CONSTRAINT "kpi_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_kpi_alerts_org_active" ON "kpi_alerts"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_kpi_alerts_kpi" ON "kpi_alerts"("kpi_id");

-- Foreign keys (idempotent-ish: ignore if already present via DO blocks where needed)
DO $$ BEGIN
  ALTER TABLE "universities" ADD CONSTRAINT "universities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_email_domains" ADD CONSTRAINT "organization_email_domains_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_branches" ADD CONSTRAINT "organization_branches_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_departments" ADD CONSTRAINT "organization_departments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_departments" ADD CONSTRAINT "organization_departments_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "organization_branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_organization_assignments" ADD CONSTRAINT "user_organization_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_organization_assignments" ADD CONSTRAINT "user_organization_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_organization_assignments" ADD CONSTRAINT "user_organization_assignments_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_organization_assignments" ADD CONSTRAINT "user_organization_assignments_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "organization_branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_organization_assignments" ADD CONSTRAINT "user_organization_assignments_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "organization_departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_cohorts" ADD CONSTRAINT "training_cohorts_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_cohorts" ADD CONSTRAINT "training_cohorts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_cohorts" ADD CONSTRAINT "training_cohorts_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "organization_branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_cohorts" ADD CONSTRAINT "training_cohorts_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "organization_departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_cohort_instructors" ADD CONSTRAINT "training_cohort_instructors_cohort_id_fkey"
    FOREIGN KEY ("cohort_id") REFERENCES "training_cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_cohort_id_fkey"
    FOREIGN KEY ("cohort_id") REFERENCES "training_cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_cohort_id_fkey"
    FOREIGN KEY ("cohort_id") REFERENCES "training_cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_attendance_windows" ADD CONSTRAINT "training_attendance_windows_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_attendance_records" ADD CONSTRAINT "training_attendance_records_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_attendance_records" ADD CONSTRAINT "training_attendance_records_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_attendance_records" ADD CONSTRAINT "training_attendance_records_window_id_fkey"
    FOREIGN KEY ("window_id") REFERENCES "training_attendance_windows"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_tasks" ADD CONSTRAINT "training_tasks_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_task_submissions" ADD CONSTRAINT "training_task_submissions_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "training_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_task_submissions" ADD CONSTRAINT "training_task_submissions_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_assessment_questions" ADD CONSTRAINT "training_assessment_questions_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "training_assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_assessment_attempts" ADD CONSTRAINT "training_assessment_attempts_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "training_assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_assessment_attempts" ADD CONSTRAINT "training_assessment_attempts_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_progress" ADD CONSTRAINT "training_progress_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_kpi_id_fkey"
    FOREIGN KEY ("kpi_id") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_kpi_id_fkey"
    FOREIGN KEY ("kpi_id") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_alerts" ADD CONSTRAINT "kpi_alerts_kpi_id_fkey"
    FOREIGN KEY ("kpi_id") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_alerts" ADD CONSTRAINT "kpi_alerts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: one UNIVERSITY organization per existing university
INSERT INTO "organizations" (
  "id", "type", "name", "name_en", "short_name", "code",
  "website", "country", "city", "address", "contact_email", "contact_phone",
  "logo_url", "status", "notes", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  'UNIVERSITY'::"organization_type",
  u."name",
  u."name_en",
  u."short_name",
  COALESCE(u."code", 'UNI-' || LEFT(REPLACE(u."id"::text, '-', ''), 12)),
  u."website",
  u."country",
  u."city",
  u."address",
  u."contact_email",
  u."contact_phone",
  u."logo_url",
  CASE WHEN u."status"::text = 'archived' THEN 'archived'::"organization_status"
       WHEN u."status"::text = 'inactive' THEN 'inactive'::"organization_status"
       ELSE 'active'::"organization_status" END,
  u."notes",
  u."created_at",
  u."updated_at"
FROM "universities" u
WHERE u."organization_id" IS NULL;

UPDATE "universities" u
SET "organization_id" = o."id"
FROM "organizations" o
WHERE u."organization_id" IS NULL
  AND o."type" = 'UNIVERSITY'
  AND o."name" = u."name"
  AND (o."code" = u."code" OR (u."code" IS NULL AND o."code" LIKE 'UNI-%'));

-- Backfill user_organization_assignments from primary_university_id + roles
INSERT INTO "user_organization_assignments" (
  "user_id", "organization_id", "role_code", "is_active", "assigned_at", "created_at", "updated_at"
)
SELECT DISTINCT ON (usr."id", uni."organization_id", COALESCE(r."code", 'student'))
  usr."id",
  uni."organization_id",
  COALESCE(r."code", 'student'),
  true,
  COALESCE(usr."created_at", NOW()),
  NOW(),
  NOW()
FROM "users" usr
JOIN "universities" uni ON uni."id" = usr."primary_university_id"
LEFT JOIN "user_roles" ur ON ur."user_id" = usr."id"
LEFT JOIN "roles" r ON r."id" = ur."role_id"
WHERE uni."organization_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user_organization_assignments" uoa
    WHERE uoa."user_id" = usr."id"
      AND uoa."organization_id" = uni."organization_id"
      AND uoa."is_active" = true
  );

-- Seed MVP KPI definitions
INSERT INTO "kpi_definitions" ("code", "name_ar", "name_en", "category", "formula_key", "description")
VALUES
  ('active_trainees', 'المتدربون النشطون', 'Active trainees', 'enrollment', 'count_active_enrollments', 'Count of active enrollments'),
  ('activation_rate', 'معدل تفعيل الحسابات', 'Account activation rate', 'activation', 'activation_rate', 'Activated / registered'),
  ('activation_overdue_48h', 'الحسابات المتأخرة 48 ساعة', 'Accounts overdue 48h', 'activation', 'count_activation_overdue', 'Pending > 48h after verify'),
  ('attendance_rate', 'معدل الحضور', 'Attendance rate', 'attendance', 'attendance_rate', 'Present+late / expected'),
  ('low_attendance_trainees', 'متدربون منخفضو الحضور', 'Low attendance trainees', 'attendance', 'count_low_attendance', 'Below required attendance'),
  ('task_submission_rate', 'معدل تسليم المهمات', 'Task submission rate', 'tasks', 'task_submission_rate', 'Submitted / assigned'),
  ('completion_rate', 'معدل الإكمال', 'Completion rate', 'completion', 'completion_rate', 'Completed / enrolled'),
  ('pre_test_avg', 'متوسط الاختبار القبلي', 'Pre-test average', 'impact', 'pre_test_avg', 'Average pre-test score'),
  ('post_test_avg', 'متوسط الاختبار البعدي', 'Post-test average', 'impact', 'post_test_avg', 'Average post-test score'),
  ('improvement_delta', 'مقدار التحسن', 'Improvement delta', 'impact', 'improvement_delta', 'Post - pre'),
  ('trainee_satisfaction', 'رضا المتدربين', 'Trainee satisfaction', 'quality', 'satisfaction_avg', 'Average course rating'),
  ('instructor_rating', 'تقييم المدرب', 'Instructor rating', 'quality', 'instructor_rating_avg', 'Average instructor rating'),
  ('certificate_eligibility_rate', 'نسبة أهلية الشهادة', 'Certificate eligibility rate', 'certificates', 'cert_eligibility_rate', 'Eligible / completed'),
  ('certificate_issue_latency', 'زمن إصدار الشهادة', 'Certificate issue latency', 'certificates', 'cert_issue_hours_avg', 'Hours to issue'),
  ('at_risk_trainees', 'المتدربون المتعثرون', 'At-risk trainees', 'alerts', 'count_at_risk', 'Early-warning count')
ON CONFLICT ("code") DO NOTHING;
