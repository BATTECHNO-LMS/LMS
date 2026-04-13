-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attendance_status" "attendance_status" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_attendance_session_student" ON "attendance_records"("session_id", "student_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_session_id" ON "attendance_records"("session_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_student_id" ON "attendance_records"("student_id");
