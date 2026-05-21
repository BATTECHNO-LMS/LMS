-- Lesson training workflow (task, upload, quiz, results)
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

CREATE UNIQUE INDEX "uq_course_lesson_student_workflow" ON "course_lesson_student_workflow"("lesson_id", "student_id");
CREATE INDEX "idx_course_lesson_questions_lesson_id" ON "course_lesson_questions"("lesson_id");
CREATE INDEX "idx_course_lesson_workflow_course_student" ON "course_lesson_student_workflow"("course_id", "student_id");

ALTER TABLE "course_lesson_training" ADD CONSTRAINT "course_lesson_training_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "course_lesson_questions" ADD CONSTRAINT "course_lesson_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "course_lesson_student_workflow" ADD CONSTRAINT "course_lesson_student_workflow_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
