-- Performance indexes for common LMS query patterns.

CREATE INDEX IF NOT EXISTS "idx_university_email_domains_domain" ON "university_email_domains"("domain");
CREATE INDEX IF NOT EXISTS "idx_university_email_domains_active" ON "university_email_domains"("is_active");

CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications"("user_id", "is_read");

CREATE INDEX IF NOT EXISTS "idx_users_status" ON "users"("status");
CREATE INDEX IF NOT EXISTS "idx_users_university_status" ON "users"("primary_university_id", "status");

CREATE INDEX IF NOT EXISTS "idx_university_specialties_university_status" ON "university_specialties"("university_id", "status");

CREATE INDEX IF NOT EXISTS "idx_field_training_applications_opportunity_status" ON "field_training_applications"("opportunity_id", "status");
CREATE INDEX IF NOT EXISTS "idx_field_training_applications_student_created" ON "field_training_applications"("student_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_ft_opportunity_eligibility_university_active" ON "field_training_opportunity_eligibility"("university_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_field_training_task_submissions_application" ON "field_training_task_submissions"("application_id");
