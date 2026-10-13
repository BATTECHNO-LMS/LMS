-- Additive data backfill: attach the affected user (subject) to legacy audit rows so the
-- student activity timeline includes historical actions performed on a student by staff.
-- Only rows with subject_user_id IS NULL are touched; no row is deleted or rewritten otherwise.

-- 1) Rows whose entity is the user itself.
UPDATE "audit_logs" a
SET "subject_user_id" = u."id"
FROM "users" u
WHERE a."subject_user_id" IS NULL
  AND a."entity_type" = 'user'
  AND a."entity_id" = u."id";

-- 2) Rows that name the student in their new/old values.
UPDATE "audit_logs" a
SET "subject_user_id" = u."id"
FROM "users" u
WHERE a."subject_user_id" IS NULL
  AND jsonb_typeof(a."new_values") = 'object'
  AND u."id"::text = COALESCE(
    a."new_values" ->> 'subjectUserId',
    a."new_values" ->> 'subject_user_id',
    a."new_values" ->> 'studentId',
    a."new_values" ->> 'student_id'
  );

UPDATE "audit_logs" a
SET "subject_user_id" = u."id"
FROM "users" u
WHERE a."subject_user_id" IS NULL
  AND jsonb_typeof(a."old_values") = 'object'
  AND u."id"::text = COALESCE(
    a."old_values" ->> 'studentId',
    a."old_values" ->> 'student_id'
  );

-- 3) Rows whose entity is owned by exactly one learner.
DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('field_training_application', 'field_training_applications', 'student_id'),
      ('field_training_task_submission', 'field_training_task_submissions', 'student_id'),
      ('field_training_attendance', 'field_training_attendance', 'student_id'),
      ('field_training_completion_letter', 'field_training_completion_letters', 'student_id'),
      ('field_training_supervisor_rating', 'field_training_supervisor_ratings', 'student_id'),
      ('field_training_final_evaluation', 'field_training_final_evaluations', 'student_id'),
      ('field_training_assessment_attempt', 'field_training_assessment_attempts', 'student_id'),
      ('enrollment', 'enrollments', 'student_id'),
      ('training_enrollment', 'training_enrollments', 'user_id'),
      ('training_task_submission', 'training_task_submissions', 'user_id'),
      ('training_attendance_record', 'training_attendance_records', 'user_id'),
      ('training_assessment_attempt', 'training_assessment_attempts', 'user_id'),
      ('training_evaluation_assignment', 'training_evaluation_assignments', 'user_id'),
      ('account_deletion_request', 'account_deletion_requests', 'user_id'),
      ('certificate', 'certificates', 'student_id'),
      ('integrity_case', 'integrity_cases', 'student_id'),
      ('user_organization_assignment', 'user_organization_assignments', 'user_id')
    ) AS t(entity_type, table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = m.table_name
        AND column_name = m.column_name
    ) THEN
      EXECUTE format(
        'UPDATE "audit_logs" a SET "subject_user_id" = e.%I
           FROM %I e
          WHERE a."subject_user_id" IS NULL
            AND a."entity_type" = %L
            AND a."entity_id" = e."id"
            AND e.%I IS NOT NULL',
        m.column_name, m.table_name, m.entity_type, m.column_name
      );
    END IF;
  END LOOP;
END $$;
