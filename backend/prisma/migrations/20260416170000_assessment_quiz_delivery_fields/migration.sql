-- Quiz timing, attempts, question bank reference, and default submission mode for assignments.
ALTER TABLE "assessments" ADD COLUMN "time_limit_minutes" INTEGER;
ALTER TABLE "assessments" ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "assessments" ADD COLUMN "shuffle_questions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assessments" ADD COLUMN "question_bank_ref" VARCHAR(255);
ALTER TABLE "assessments" ADD COLUMN "preferred_submission_type" "submission_type";
