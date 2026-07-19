-- BATTECHNO LMS — empty database bootstrap (DB-MIGRATION-002)
-- Generated from prisma/schema.prisma via `prisma migrate diff --from-empty`.
-- Structure only. No data. Do NOT run against shared/production Neon.
-- Apply only through: npm run db:init-empty (guards enforced).
-- Generated-at: 2026-07-18T11:02:39.797Z

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('draft', 'published', 'open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('quiz', 'assignment', 'lab', 'practical_exam', 'milestone', 'capstone_project', 'presentation');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('started', 'submitted', 'late_submitted', 'cancelled', 'graded');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('present', 'late', 'absent', 'excused');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('issued', 'revoked', 'superseded');

-- CreateEnum
CREATE TYPE "cohort_status" AS ENUM ('planned', 'open_for_enrollment', 'active', 'completed', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "content_type" AS ENUM ('lesson', 'pdf', 'video', 'external_link', 'lab_guide', 'assignment_guide', 'project_brief');

-- CreateEnum
CREATE TYPE "corrective_action_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'overdue');

-- CreateEnum
CREATE TYPE "delivery_mode" AS ENUM ('online', 'onsite', 'hybrid', 'self_paced');

-- CreateEnum
CREATE TYPE "documentation_status" AS ENUM ('pending', 'documented', 'incomplete');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('pending', 'enrolled', 'withdrawn', 'cancelled', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "final_status" AS ENUM ('in_progress', 'passed', 'failed', 'withdrawn', 'incomplete');

-- CreateEnum
CREATE TYPE "integrity_case_status" AS ENUM ('reported', 'under_investigation', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "integrity_case_type" AS ENUM ('cheating', 'plagiarism', 'non_original_submission', 'attendance_manipulation', 'unauthorized_tools', 'other');

-- CreateEnum
CREATE TYPE "internal_approval_status" AS ENUM ('not_started', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "micro_credential_status" AS ENUM ('draft', 'under_review', 'approved', 'active', 'archived');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('info', 'success', 'warning', 'danger', 'system', 'user_pending_activation', 'action_required', 'student_enrollment_requested', 'enrollment_approved', 'enrollment_rejected');

-- CreateEnum
CREATE TYPE "partnership_status" AS ENUM ('active', 'inactive', 'pending', 'ended');

-- CreateEnum
CREATE TYPE "qa_review_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "recognition_document_type" AS ENUM ('credential_description', 'alignment_matrix', 'attendance_report', 'grades_report', 'evidence_samples', 'delivery_report', 'qa_report', 'academic_recommendation', 'other');

-- CreateEnum
CREATE TYPE "recognition_eligibility_status" AS ENUM ('unknown', 'eligible', 'not_eligible', 'under_review');

-- CreateEnum
CREATE TYPE "recognition_request_status" AS ENUM ('draft', 'in_preparation', 'ready_for_submission', 'submitted', 'under_review', 'approved', 'rejected', 'needs_revision');

-- CreateEnum
CREATE TYPE "review_type" AS ENUM ('scheduled', 'periodic', 'pre_closure', 'special');

-- CreateEnum
CREATE TYPE "risk_case_status" AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'escalated');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "risk_type" AS ENUM ('low_attendance', 'assessment_failure', 'missing_project', 'continuous_decline', 'other');

-- CreateEnum
CREATE TYPE "role_scope" AS ENUM ('global', 'university');

-- CreateEnum
CREATE TYPE "session_type" AS ENUM ('lecture', 'lab', 'workshop', 'review', 'assessment', 'other');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('draft', 'submitted', 'late', 'resubmitted', 'graded', 'returned');

-- CreateEnum
CREATE TYPE "submission_type" AS ENUM ('file', 'repo_url', 'text_response', 'mixed');

-- CreateEnum
CREATE TYPE "track_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "university_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "specialty_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "course_level" AS ENUM ('beginner', 'intermediate', 'advanced', 'all_levels');

-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "course_lesson_type" AS ENUM ('video', 'text', 'link', 'file');

-- CreateEnum
CREATE TYPE "course_lesson_status" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "course_enrollment_status" AS ENUM ('active', 'completed');

-- CreateEnum
CREATE TYPE "field_training_mode" AS ENUM ('onsite', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "field_training_opportunity_status" AS ENUM ('draft', 'published', 'in_progress', 'archived');

-- CreateEnum
CREATE TYPE "field_training_application_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "field_training_training_status" AS ENUM ('none', 'pre_assessment_pending', 'pre_assessment_completed', 'ready_for_training', 'in_training', 'task_pending', 'task_submitted', 'post_assessment_pending', 'post_assessment_completed', 'eligible_for_completion', 'completed', 'failed', 'expelled');

-- CreateEnum
CREATE TYPE "field_training_knowledge_level" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "field_training_final_task_status" AS ENUM ('not_required', 'pending', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "field_training_completion_eligibility_status" AS ENUM ('pending', 'eligible', 'ineligible', 'needs_review');

-- CreateEnum
CREATE TYPE "field_training_attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "field_training_assessment_type" AS ENUM ('pre', 'post');

-- CreateEnum
CREATE TYPE "field_training_assessment_status" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "field_training_question_type" AS ENUM ('multiple_choice', 'true_false', 'short_answer', 'short_text', 'long_text', 'multi_select');

-- CreateEnum
CREATE TYPE "field_training_task_review_status" AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');

-- CreateEnum
CREATE TYPE "field_training_completion_letter_status" AS ENUM ('issued', 'revoked');

-- CreateEnum
CREATE TYPE "file_visibility" AS ENUM ('public', 'private');

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "instructor_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "cohort_status" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content_type" "content_type" NOT NULL,
    "file_url" TEXT,
    "external_url" TEXT,
    "sequence_no" INTEGER NOT NULL,
    "publish_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "qa_review_id" UUID NOT NULL,
    "assigned_to" UUID,
    "action_text" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "corrective_action_status" NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrollment_status" "enrollment_status" NOT NULL DEFAULT 'pending',
    "final_status" "final_status" NOT NULL DEFAULT 'in_progress',
    "final_grade" DECIMAL(5,2),
    "attendance_percentage" DECIMAL(5,2) DEFAULT 0,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completion_date" DATE,
    "certificate_issued_at" TIMESTAMPTZ(6),
    "recognition_eligibility_status" "recognition_eligibility_status" DEFAULT 'unknown',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
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
    "time_limit_minutes" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "question_bank_ref" VARCHAR(255),
    "preferred_submission_type" "submission_type",
    "status" "assessment_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "student_id" UUID,
    "assessment_id" UUID,
    "session_id" UUID,
    "evidence_type" VARCHAR(100) NOT NULL,
    "file_url" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "grader_id" UUID,
    "score" DECIMAL(6,2) NOT NULL,
    "feedback" TEXT,
    "graded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "assessment_id" UUID,
    "reported_by" UUID,
    "case_type" "integrity_case_type" NOT NULL,
    "evidence_notes" TEXT,
    "decision" TEXT,
    "status" "integrity_case_status" NOT NULL DEFAULT 'reported',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrity_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "outcome_code" VARCHAR(80) NOT NULL,
    "outcome_text" TEXT NOT NULL,
    "outcome_type" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_credential_universities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "micro_credential_universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_credential_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "micro_credential_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "level" VARCHAR(100) NOT NULL,
    "duration_hours" DECIMAL(8,2) NOT NULL,
    "delivery_mode" "delivery_mode" NOT NULL,
    "prerequisites" TEXT,
    "passing_policy" TEXT,
    "attendance_policy" TEXT,
    "internal_approval_status" "internal_approval_status" NOT NULL DEFAULT 'not_started',
    "status" "micro_credential_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "micro_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "micro_credential_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sequence_no" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "type" "notification_type" NOT NULL DEFAULT 'info',
    "action_url" VARCHAR(2000),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "micro_credential_id" UUID NOT NULL,
    "certificate_no" VARCHAR(80) NOT NULL,
    "verification_code" VARCHAR(64) NOT NULL,
    "qr_code_url" TEXT,
    "status" "certificate_status" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "university_id" UUID,
    "action_type" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "module" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "review_date" DATE NOT NULL,
    "review_type" "review_type" NOT NULL DEFAULT 'scheduled',
    "findings" TEXT,
    "action_required" TEXT,
    "status" "qa_review_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognition_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recognition_request_id" UUID NOT NULL,
    "document_type" "recognition_document_type" NOT NULL,
    "file_url" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recognition_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognition_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "micro_credential_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "created_by" UUID,
    "status" "recognition_request_status" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "decision_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recognition_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "risk_type" "risk_type" NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "opened_by" UUID,
    "action_plan" TEXT,
    "status" "risk_case_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "scope" "role_scope" NOT NULL DEFAULT 'university',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rubric_id" UUID NOT NULL,
    "criterion_name" VARCHAR(255) NOT NULL,
    "criterion_description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" UUID NOT NULL,
    "module_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "session_type" "session_type" NOT NULL DEFAULT 'lecture',
    "notes" TEXT,
    "documentation_status" "documentation_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attendance_status" "attendance_status" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt_id" UUID,
    "submission_type" "submission_type" NOT NULL,
    "file_url" TEXT,
    "repo_url" TEXT,
    "text_response" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "submission_status" NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "setting_key" VARCHAR(150) NOT NULL,
    "setting_value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "status" "track_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(120),
    "contact_person" VARCHAR(255),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "status" "university_status" NOT NULL DEFAULT 'active',
    "partnership_state" "partnership_status" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_email_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_email_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "relationship_type" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" VARCHAR(50),
    "status" "user_status" NOT NULL DEFAULT 'inactive',
    "primary_university_id" UUID,
    "university_specialty_id" UUID,
    "specialty_id" UUID,
    "activated_at" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(50),
    "status" "specialty_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_specialties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "specialty_id" UUID,
    "name_ar" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "code" VARCHAR(80) NOT NULL,
    "college_name_ar" VARCHAR(255),
    "college_name_en" VARCHAR(255),
    "status" "specialty_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "short_description" TEXT,
    "description" TEXT,
    "cover_image_url" TEXT,
    "category" VARCHAR(120),
    "level" "course_level" NOT NULL DEFAULT 'beginner',
    "status" "course_status" NOT NULL DEFAULT 'draft',
    "estimated_duration_minutes" INTEGER,
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "course_lesson_type" NOT NULL,
    "video_url" TEXT,
    "content" TEXT,
    "resource_url" TEXT,
    "duration_minutes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "course_lesson_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_cohorts" (
    "course_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_cohorts_pkey" PRIMARY KEY ("course_id","cohort_id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "course_enrollment_status" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_training" (
    "lesson_id" UUID NOT NULL,
    "task_instructions" TEXT,
    "task_file_url" TEXT,
    "task_file_name" VARCHAR(255),
    "model_answer_url" TEXT,
    "model_answer_name" VARCHAR(255),
    "correction_prompt" TEXT,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "pass_score" INTEGER NOT NULL DEFAULT 60,
    "upload_weight" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lesson_training_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "course_lesson_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "code_snippet" TEXT,
    "points" INTEGER NOT NULL DEFAULT 5,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "expected_answer" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lesson_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lesson_student_workflow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "submission_file_path" TEXT,
    "submission_file_name" VARCHAR(255),
    "submission_size_bytes" INTEGER,
    "submitted_at" TIMESTAMPTZ(6),
    "answers_json" JSONB,
    "upload_score" INTEGER,
    "quiz_score" INTEGER,
    "total_score" INTEGER,
    "passed" BOOLEAN,
    "feedback_summary" TEXT,
    "correction_details" TEXT,
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_lesson_student_workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "organization_name" VARCHAR(255),
    "university_id" UUID,
    "specialty_id" UUID,
    "assigned_instructor_id" UUID,
    "location" VARCHAR(255) NOT NULL,
    "training_mode" "field_training_mode" NOT NULL,
    "short_description" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "benefits" TEXT,
    "seats_limit" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "application_deadline" DATE,
    "requires_pre_assessment" BOOLEAN NOT NULL DEFAULT true,
    "requires_post_assessment" BOOLEAN NOT NULL DEFAULT true,
    "requires_final_task" BOOLEAN NOT NULL DEFAULT true,
    "minimum_attendance_percentage" INTEGER,
    "minimum_post_assessment_score" DECIMAL(5,2),
    "completion_rules" JSONB,
    "status" "field_training_opportunity_status" NOT NULL DEFAULT 'draft',
    "training_started_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_opportunity_eligibility" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "university_specialty_id" UUID NOT NULL,
    "canonical_specialty_id" UUID,
    "seats_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_opportunity_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "field_training_application_status" NOT NULL DEFAULT 'pending',
    "training_status" "field_training_training_status" NOT NULL DEFAULT 'none',
    "student_message" TEXT,
    "admin_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "training_started_at" TIMESTAMPTZ(6),
    "pre_assessment_score" DECIMAL(6,2),
    "pre_assessment_level" "field_training_knowledge_level",
    "post_assessment_score" DECIMAL(6,2),
    "attendance_percentage" DECIMAL(5,2),
    "final_task_status" "field_training_final_task_status" NOT NULL DEFAULT 'not_required',
    "completion_eligibility_status" "field_training_completion_eligibility_status" NOT NULL DEFAULT 'pending',
    "eligibility_reason" JSONB,
    "expelled_at" TIMESTAMPTZ(6),
    "expelled_by_id" UUID,
    "expulsion_reason" TEXT,
    "completion_letter_issued_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opportunity_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE,
    "ai_self_evaluation_prompt" TEXT,
    "requires_ai_self_evaluation" BOOLEAN NOT NULL DEFAULT false,
    "is_final_task" BOOLEAN NOT NULL DEFAULT false,
    "instruction_file_path" VARCHAR(500),
    "instruction_file_name" VARCHAR(255),
    "instruction_file_mime_type" VARCHAR(120),
    "instruction_file_size" INTEGER,
    "instruction_file_uploaded_at" TIMESTAMPTZ(6),
    "instruction_file_uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_task_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "student_self_evaluation_input" TEXT,
    "ai_prompt_used" TEXT,
    "ai_model_provider" VARCHAR(80),
    "ai_model_name" VARCHAR(120),
    "ai_raw_response" TEXT,
    "ai_response_inserted_text" TEXT,
    "final_student_notes" TEXT,
    "ai_evaluated_at" TIMESTAMPTZ(6),
    "file_path" VARCHAR(500),
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(120),
    "project_url" TEXT,
    "analysis_file_id" UUID,
    "file_extraction_status" VARCHAR(40),
    "file_extracted_text" TEXT,
    "url_extraction_status" VARCHAR(40),
    "url_extracted_text" TEXT,
    "extraction_errors" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "review_status" "field_training_task_review_status" NOT NULL DEFAULT 'pending',
    "instructor_feedback" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "field_training_assessment_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "field_training_question_type" NOT NULL,
    "options" JSONB,
    "correct_answer" JSONB,
    "points" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_training_assessment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "answers" JSONB,
    "grading_details" JSONB,
    "score" DECIMAL(6,2),
    "max_score" DECIMAL(6,2),
    "level" "field_training_knowledge_level",
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_training_assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "created_by_id" UUID,
    "related_entity_type" VARCHAR(100),
    "related_entity_id" UUID,
    "original_name" VARCHAR(500) NOT NULL,
    "storage_key" VARCHAR(1024) NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size" BIGINT NOT NULL,
    "visibility" "file_visibility" NOT NULL DEFAULT 'private',
    "url" VARCHAR(2048),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cohorts_instructor_id" ON "cohorts"("instructor_id");

-- CreateIndex
CREATE INDEX "idx_cohorts_micro_credential_id" ON "cohorts"("micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_cohorts_status" ON "cohorts"("status");

-- CreateIndex
CREATE INDEX "idx_cohorts_university_id" ON "cohorts"("university_id");

-- CreateIndex
CREATE INDEX "idx_contents_module_id" ON "contents"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contents_sequence" ON "contents"("module_id", "sequence_no");

-- CreateIndex
CREATE INDEX "idx_corrective_actions_qa_review_id" ON "corrective_actions"("qa_review_id");

-- CreateIndex
CREATE INDEX "idx_corrective_actions_status" ON "corrective_actions"("status");

-- CreateIndex
CREATE INDEX "idx_enrollments_cohort_id" ON "enrollments"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_enrollments_final_status" ON "enrollments"("final_status");

-- CreateIndex
CREATE INDEX "idx_enrollments_student_id" ON "enrollments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollments" ON "enrollments"("cohort_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_assessments_cohort_id" ON "assessments"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_assessments_micro_credential_id" ON "assessments"("micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_assessments_linked_outcome_id" ON "assessments"("linked_outcome_id");

-- CreateIndex
CREATE INDEX "idx_assessments_rubric_id" ON "assessments"("rubric_id");

-- CreateIndex
CREATE INDEX "idx_assessments_status" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "idx_evidence_files_assessment_id" ON "evidence_files"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_evidence_files_cohort_id" ON "evidence_files"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_evidence_files_micro_credential_id" ON "evidence_files"("micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_evidence_files_session_id" ON "evidence_files"("session_id");

-- CreateIndex
CREATE INDEX "idx_evidence_files_student_id" ON "evidence_files"("student_id");

-- CreateIndex
CREATE INDEX "idx_grades_assessment_id" ON "grades"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_grades_student_id" ON "grades"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_grades" ON "grades"("assessment_id", "student_id", "is_final");

-- CreateIndex
CREATE INDEX "idx_integrity_cases_cohort_id" ON "integrity_cases"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_integrity_cases_status" ON "integrity_cases"("status");

-- CreateIndex
CREATE INDEX "idx_integrity_cases_student_id" ON "integrity_cases"("student_id");

-- CreateIndex
CREATE INDEX "idx_learning_outcomes_micro_credential_id" ON "learning_outcomes"("micro_credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_learning_outcomes_code" ON "learning_outcomes"("micro_credential_id", "outcome_code");

-- CreateIndex
CREATE INDEX "idx_micro_credential_universities_university_id" ON "micro_credential_universities"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_micro_credential_universities" ON "micro_credential_universities"("micro_credential_id", "university_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_micro_credential_versions" ON "micro_credential_versions"("micro_credential_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "micro_credentials_code_key" ON "micro_credentials"("code");

-- CreateIndex
CREATE INDEX "idx_micro_credentials_status" ON "micro_credentials"("status");

-- CreateIndex
CREATE INDEX "idx_micro_credentials_track_id" ON "micro_credentials"("track_id");

-- CreateIndex
CREATE INDEX "idx_modules_micro_credential_id" ON "modules"("micro_credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_modules_sequence" ON "modules"("micro_credential_id", "sequence_no");

-- CreateIndex
CREATE INDEX "idx_notifications_is_read" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_user_read" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_no_key" ON "certificates"("certificate_no");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verification_code_key" ON "certificates"("verification_code");

-- CreateIndex
CREATE INDEX "idx_certificates_student_id" ON "certificates"("student_id");

-- CreateIndex
CREATE INDEX "idx_certificates_cohort_id" ON "certificates"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_certificates_micro_credential_id" ON "certificates"("micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_certificates_status" ON "certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_certificates_student_cohort_mc" ON "certificates"("student_id", "cohort_id", "micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_university_id" ON "audit_logs"("university_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs"("action_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity_type" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_qa_reviews_cohort_id" ON "qa_reviews"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_qa_reviews_status" ON "qa_reviews"("status");

-- CreateIndex
CREATE INDEX "idx_recognition_documents_request_id" ON "recognition_documents"("recognition_request_id");

-- CreateIndex
CREATE INDEX "idx_recognition_requests_cohort_id" ON "recognition_requests"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_recognition_requests_micro_credential_id" ON "recognition_requests"("micro_credential_id");

-- CreateIndex
CREATE INDEX "idx_recognition_requests_status" ON "recognition_requests"("status");

-- CreateIndex
CREATE INDEX "idx_recognition_requests_university_id" ON "recognition_requests"("university_id");

-- CreateIndex
CREATE INDEX "idx_risk_cases_cohort_id" ON "risk_cases"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_risk_cases_status" ON "risk_cases"("status");

-- CreateIndex
CREATE INDEX "idx_risk_cases_student_id" ON "risk_cases"("student_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission_id" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_permissions" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "idx_sessions_cohort_id" ON "sessions"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_sessions_module_id" ON "sessions"("module_id");

-- CreateIndex
CREATE INDEX "idx_sessions_session_date" ON "sessions"("session_date");

-- CreateIndex
CREATE INDEX "idx_attendance_records_session_id" ON "attendance_records"("session_id");

-- CreateIndex
CREATE INDEX "idx_attendance_records_student_id" ON "attendance_records"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attendance_session_student" ON "attendance_records"("session_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_submissions_assessment_id" ON "submissions"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_submissions_attempt_id" ON "submissions"("attempt_id");

-- CreateIndex
CREATE INDEX "idx_submissions_status" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "idx_submissions_student_id" ON "submissions"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_submissions_assessment_student" ON "submissions"("assessment_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_code_key" ON "tracks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_universities_name" ON "universities"("name");

-- CreateIndex
CREATE INDEX "idx_university_email_domains_university_id" ON "university_email_domains"("university_id");

-- CreateIndex
CREATE INDEX "idx_university_email_domains_domain" ON "university_email_domains"("domain");

-- CreateIndex
CREATE INDEX "idx_university_email_domains_active" ON "university_email_domains"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_university_email_domains_university_domain" ON "university_email_domains"("university_id", "domain");

-- CreateIndex
CREATE INDEX "idx_university_users_university_id" ON "university_users"("university_id");

-- CreateIndex
CREATE INDEX "idx_university_users_user_id" ON "university_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_university_users" ON "university_users"("university_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_role_id" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_user_id" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_roles" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_primary_university_id" ON "users"("primary_university_id");

-- CreateIndex
CREATE INDEX "idx_users_university_specialty_id" ON "users"("university_specialty_id");

-- CreateIndex
CREATE INDEX "idx_users_specialty_id" ON "users"("specialty_id");

-- CreateIndex
CREATE INDEX "idx_users_email_verified_at" ON "users"("email_verified_at");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_users_university_status" ON "users"("primary_university_id", "status");

-- CreateIndex
CREATE INDEX "idx_email_verification_otps_user_id" ON "email_verification_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_verification_otps_email" ON "email_verification_otps"("email");

-- CreateIndex
CREATE INDEX "idx_email_verification_otps_expires_at" ON "email_verification_otps"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_email" ON "password_reset_otps"("email");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_user_id" ON "password_reset_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_expires_at" ON "password_reset_otps"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_otps_reset_token_hash" ON "password_reset_otps"("reset_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_code_key" ON "specialties"("code");

-- CreateIndex
CREATE INDEX "idx_specialties_status" ON "specialties"("status");

-- CreateIndex
CREATE INDEX "idx_university_specialties_university_id" ON "university_specialties"("university_id");

-- CreateIndex
CREATE INDEX "idx_university_specialties_specialty_id" ON "university_specialties"("specialty_id");

-- CreateIndex
CREATE INDEX "idx_university_specialties_status" ON "university_specialties"("status");

-- CreateIndex
CREATE INDEX "idx_university_specialties_university_status" ON "university_specialties"("university_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_university_specialties_university_code" ON "university_specialties"("university_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "idx_courses_status" ON "courses"("status");

-- CreateIndex
CREATE INDEX "idx_courses_level" ON "courses"("level");

-- CreateIndex
CREATE INDEX "idx_courses_created_by_id" ON "courses"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_course_sections_course_id" ON "course_sections"("course_id");

-- CreateIndex
CREATE INDEX "idx_course_lessons_course_id" ON "course_lessons"("course_id");

-- CreateIndex
CREATE INDEX "idx_course_lessons_section_id" ON "course_lessons"("section_id");

-- CreateIndex
CREATE INDEX "idx_course_lessons_status" ON "course_lessons"("status");

-- CreateIndex
CREATE INDEX "idx_course_cohorts_cohort_id" ON "course_cohorts"("cohort_id");

-- CreateIndex
CREATE INDEX "idx_course_enrollments_student_id" ON "course_enrollments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_course_enrollments" ON "course_enrollments"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_course_lesson_progress_course_student" ON "course_lesson_progress"("course_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_course_lesson_progress" ON "course_lesson_progress"("lesson_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_course_lesson_questions_lesson_id" ON "course_lesson_questions"("lesson_id");

-- CreateIndex
CREATE INDEX "idx_course_lesson_workflow_course_student" ON "course_lesson_student_workflow"("course_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_course_lesson_student_workflow" ON "course_lesson_student_workflow"("lesson_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_training_opportunities_slug_key" ON "field_training_opportunities"("slug");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_status" ON "field_training_opportunities"("status");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_mode" ON "field_training_opportunities"("training_mode");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_created_by" ON "field_training_opportunities"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_university" ON "field_training_opportunities"("university_id");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_specialty" ON "field_training_opportunities"("specialty_id");

-- CreateIndex
CREATE INDEX "idx_field_training_opportunities_instructor" ON "field_training_opportunities"("assigned_instructor_id");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_opportunity" ON "field_training_opportunity_eligibility"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_university" ON "field_training_opportunity_eligibility"("university_id");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_university_specialty" ON "field_training_opportunity_eligibility"("university_specialty_id");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_canonical" ON "field_training_opportunity_eligibility"("canonical_specialty_id");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_active" ON "field_training_opportunity_eligibility"("is_active");

-- CreateIndex
CREATE INDEX "idx_ft_opportunity_eligibility_university_active" ON "field_training_opportunity_eligibility"("university_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ft_opportunity_eligibility" ON "field_training_opportunity_eligibility"("opportunity_id", "university_id", "university_specialty_id");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_opportunity" ON "field_training_applications"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_student" ON "field_training_applications"("student_id");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_status" ON "field_training_applications"("status");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_training_status" ON "field_training_applications"("training_status");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_opportunity_status" ON "field_training_applications"("opportunity_id", "status");

-- CreateIndex
CREATE INDEX "idx_field_training_applications_student_created" ON "field_training_applications"("student_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_training_applications" ON "field_training_applications"("opportunity_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_field_training_tasks_opportunity" ON "field_training_tasks"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_field_training_task_submissions_student" ON "field_training_task_submissions"("student_id");

-- CreateIndex
CREATE INDEX "idx_field_training_task_submissions_review_status" ON "field_training_task_submissions"("review_status");

-- CreateIndex
CREATE INDEX "idx_field_training_task_submissions_application" ON "field_training_task_submissions"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_training_task_submissions" ON "field_training_task_submissions"("task_id", "application_id");

-- CreateIndex
CREATE INDEX "idx_field_training_sessions_opportunity" ON "field_training_sessions"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_field_training_sessions_date" ON "field_training_sessions"("session_date");

-- CreateIndex
CREATE INDEX "idx_field_training_attendance_student" ON "field_training_attendance"("student_id");

-- CreateIndex
CREATE INDEX "idx_field_training_attendance_application" ON "field_training_attendance"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_training_attendance_session_application" ON "field_training_attendance"("session_id", "application_id");

-- CreateIndex
CREATE INDEX "idx_field_training_assessments_opportunity" ON "field_training_assessments"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_field_training_assessments_status" ON "field_training_assessments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_training_assessments_opportunity_type" ON "field_training_assessments"("opportunity_id", "type");

-- CreateIndex
CREATE INDEX "idx_field_training_assessment_questions_assessment" ON "field_training_assessment_questions"("assessment_id");

-- CreateIndex
CREATE INDEX "idx_field_training_assessment_attempts_student" ON "field_training_assessment_attempts"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_field_training_assessment_attempts" ON "field_training_assessment_attempts"("assessment_id", "application_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_training_completion_letters_letter_no_key" ON "field_training_completion_letters"("letter_no");

-- CreateIndex
CREATE UNIQUE INDEX "field_training_completion_letters_verification_code_key" ON "field_training_completion_letters"("verification_code");

-- CreateIndex
CREATE INDEX "idx_field_training_completion_letters_student" ON "field_training_completion_letters"("student_id");

-- CreateIndex
CREATE INDEX "idx_field_training_completion_letters_opportunity" ON "field_training_completion_letters"("opportunity_id");

-- CreateIndex
CREATE INDEX "idx_field_training_completion_letters_status" ON "field_training_completion_letters"("status");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "idx_files_user_id" ON "files"("user_id");

-- CreateIndex
CREATE INDEX "idx_files_created_by_id" ON "files"("created_by_id");

-- CreateIndex
CREATE INDEX "idx_files_related_entity" ON "files"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "idx_files_deleted_at" ON "files"("deleted_at");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_micro_credential_id_fkey" FOREIGN KEY ("micro_credential_id") REFERENCES "micro_credentials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_linked_outcome_id_fkey" FOREIGN KEY ("linked_outcome_id") REFERENCES "learning_outcomes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "university_email_domains" ADD CONSTRAINT "university_email_domains_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_university_specialty_id_fkey" FOREIGN KEY ("university_specialty_id") REFERENCES "university_specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "university_specialties" ADD CONSTRAINT "university_specialties_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "university_specialties" ADD CONSTRAINT "university_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_cohorts" ADD CONSTRAINT "course_cohorts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_cohorts" ADD CONSTRAINT "course_cohorts_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lesson_progress" ADD CONSTRAINT "course_lesson_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lesson_progress" ADD CONSTRAINT "course_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lesson_training" ADD CONSTRAINT "course_lesson_training_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lesson_questions" ADD CONSTRAINT "course_lesson_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_lesson_student_workflow" ADD CONSTRAINT "course_lesson_student_workflow_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunities" ADD CONSTRAINT "field_training_opportunities_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunities" ADD CONSTRAINT "field_training_opportunities_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_university_specialt_fkey" FOREIGN KEY ("university_specialty_id") REFERENCES "university_specialties"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_opportunity_eligibility" ADD CONSTRAINT "field_training_opportunity_eligibility_canonical_specialty_fkey" FOREIGN KEY ("canonical_specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_applications" ADD CONSTRAINT "field_training_applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_tasks" ADD CONSTRAINT "field_training_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_task_submissions" ADD CONSTRAINT "field_training_task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "field_training_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_task_submissions" ADD CONSTRAINT "field_training_task_submissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_sessions" ADD CONSTRAINT "field_training_sessions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_attendance" ADD CONSTRAINT "field_training_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "field_training_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_attendance" ADD CONSTRAINT "field_training_attendance_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_assessments" ADD CONSTRAINT "field_training_assessments_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_assessment_questions" ADD CONSTRAINT "field_training_assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "field_training_assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_assessment_attempts" ADD CONSTRAINT "field_training_assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "field_training_assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_assessment_attempts" ADD CONSTRAINT "field_training_assessment_attempts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_completion_letters" ADD CONSTRAINT "field_training_completion_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "field_training_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "field_training_completion_letters" ADD CONSTRAINT "field_training_completion_letters_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "field_training_opportunities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
